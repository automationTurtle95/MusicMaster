// Reference implementation for LUH-211 — harness retry/backoff on adapter_failed.
//
// Portable module: it has NO app-specific imports so the Paperclip agent-runtime
// team can drop it into the component that spawns opencode for a run (the only
// layer that observes `adapter_failed` and can re-invoke). See
// docs/LUH-211-design-handoff.md for the operator-facing UX that consumes these.
//
// Design lens applied:
//  - Norman (feedback/mapping): every transient failure yields an observable,
//    named state so the operator never experiences a "silent hang" (LUH-84 fear).
//  - Nielsen error heuristic: failures are classified so non-retryable faults
//    (auth, DB) are NEVER offered a "retry" that cannot succeed.
//  - Discriminator (LUH-154 vs LUH-210): `ref: err_*` + "Unexpected server error"
//    is transient; "Failed to execute statement" (NO ref) is a persistent DB fault.

export type AdapterErrorName =
  | "UnknownError"
  | "RateLimitError"
  | (string & {});

export interface AdapterFailedPayload {
  type: "error";
  sessionID?: string;
  error: {
    name?: AdapterErrorName;
    message?: string;
    status?: number;
    ref?: string;
    data?: {
      message?: string;
      status?: number;
      statusCode?: number;
      isRetryable?: boolean;
      ref?: string;
      metadata?: Record<string, unknown>;
    };
  };
}

// Backoff policy — mirrors docs/LUH-154-disposition.md §2.
// Tunable via the harness config surface (§5); defaults here are the reference.
export const RetryPolicy = {
  MAX_RETRIES: 5, // transient-only; whole-run retries stay separate
  BASE_DELAY_MS: 1000, // 1s
  FACTOR: 2, // 1s, 2s, 4s, 8s, 16s  (~31s of backoff)
  MAX_DELAY_MS: 30000,
  TOTAL_CAP_MS: 120000, // give up after ~2 min of transient errors
  JITTER_MS: 1000, // full jitter on the base window
} as const;

export type RetryPolicyShape = typeof RetryPolicy;

// Failure classification — the heart of the discriminator.
export type FailureClass =
  | "transient" // retry with backoff (LUH-154: 5xx / 429 / UnknownError / ref:err_*)
  | "db_fault" // LUH-210: persistent server-state fault, do NOT retry
  | "auth_config" // 401/403/400: config/key — fail fast, actionable to operator
  | "unknown"; // default: do not retry unless evidence says otherwise

const DB_FAULT_RE = /failed to execute statement/i;
const UNEXPECTED_RE = /unexpected server error/i;
const RATE_LIMIT_RE = /rate[ _-]?(?:limit|exceeded|quota)|too[ -]?many[ -]?requests/i;
const REF_ERR_RE = /^err_/i;
const AUTH_HINT_RE = /auth|api[ _-]?key|permission|forbidden|unauthorized/i;

export function classifyFailure(payload: AdapterFailedPayload): FailureClass {
  const e = payload?.error ?? {};
  const msg = (e.message ?? e.data?.message ?? "").toString();
  // Some providers (OpenRouter) surface the HTTP status as `statusCode` inside `data`
  // rather than the top-level `status` field used by others.
  const status =
    typeof e.status === "number"
      ? e.status
      : typeof e.data?.status === "number"
        ? e.data.status
        : typeof e.data?.statusCode === "number"
          ? e.data.statusCode
          : undefined;
  const ref = e.ref ?? e.data?.ref;
  const isRetryable = e.data?.isRetryable;

  // LUH-210: DB fault — distinct signature, never transient. Fail fast.
  if (DB_FAULT_RE.test(msg)) return "db_fault";

  // Auth/config — never succeed on retry. Actionable to operator.
  if (status === 401 || status === 403 || status === 400) return "auth_config";

  // Transient (LUH-154): OpenAI UnknownError
  if (e.name === "UnknownError") return "transient";

  // Transient: provider rate-limit (HTTP 429, or rate-limit message flagged
  // isRetryable:true). Covers OpenRouter free-tier exhaustion
  // ("Rate limit exceeded: free-models-per-day", statusCode 429) and OpenAI 429.
  if (status === 429) return "transient";
  if (RATE_LIMIT_RE.test(msg) && isRetryable !== false) return "transient";

  // Transient: OpenAI 5xx with ref
  if (UNEXPECTED_RE.test(msg) && REF_ERR_RE.test(ref ?? "")) return "transient";

  // Transient: HTTP 5xx
  if (typeof status === "number" && (status >= 500 || status === 429)) {
    return "transient";
  }
  if (ref && REF_ERR_RE.test(ref)) return "transient";

  // Fuzzy auth hint without a clear status: treat as non-transient to avoid
  // masking a real config problem behind retries (data-minimization of retries).
  if (AUTH_HINT_RE.test(msg) && status != null && status < 500) {
    return "auth_config";
  }

  return "unknown";
}

export function isTransient(payload: AdapterFailedPayload): boolean {
  return classifyFailure(payload) === "transient";
}

// Exponential backoff with full jitter on the base window.
// attempt is 0-based (0 -> ~1s, 1 -> ~2s, ...).
export function nextBackoffDelay(
  attempt: number,
  policy: RetryPolicyShape = RetryPolicy,
  rng: () => number = Math.random,
): number {
  const exp = Math.min(
    policy.MAX_DELAY_MS,
    policy.BASE_DELAY_MS * Math.pow(policy.FACTOR, attempt),
  );
  const jitter = rng() * policy.JITTER_MS;
  return Math.round(exp + jitter);
}

// Operator-facing status bridge — consumed by the run dashboard.
// Returns the tone + copy for each retry/failure state (see design handoff).
export type RetryTone = "info" | "warning" | "danger" | "success";

export interface OperatorStatus {
  tone: RetryTone;
  title: string;
  message: string;
  // The single primary affordance shown; null means "no action needed / wait".
  primaryAction: "retry_now" | "fix_config" | "investigate_db" | null;
  announce: "polite" | "assertive"; // aria-live politeness
}

export function describeOperatorStatus(args: {
  failureClass: FailureClass;
  attempt: number; // 0-based count of retries already performed
  nextDelayMs: number;
  recovered: boolean;
  maxRetries: number;
}): OperatorStatus {
  const { failureClass, attempt, nextDelayMs, recovered, maxRetries } = args;

  if (recovered) {
    return {
      tone: "success",
      title: "Recovered",
      message: `The model service responded after ${attempt} ${
        attempt === 1 ? "retry" : "retries"
      }. No action needed.`,
      primaryAction: null,
      announce: "assertive",
    };
  }

  if (failureClass === "transient") {
    const remaining = Math.max(0, maxRetries - attempt);
    const seconds = Math.ceil(nextDelayMs / 1000);
    return {
      tone: remaining <= 1 ? "warning" : "info",
      title: "Temporary model-service hiccup",
      message: `Retrying automatically (attempt ${attempt + 1} of ${maxRetries}). Next try in about ${seconds}s. Your request is safe — you don't need to do anything.`,
      primaryAction: null,
      announce: "polite",
    };
  }

  if (failureClass === "auth_config") {
    return {
      tone: "danger",
      title: "Configuration problem (not a model outage)",
      message:
        "The model service rejected the request because of a key, permission, or configuration issue. Automatic retries won't help — an operator needs to fix the configuration, then re-run.",
      primaryAction: "fix_config",
      announce: "assertive",
    };
  }

  if (failureClass === "db_fault") {
    return {
      tone: "danger",
      title: "Database error (not a model outage)",
      message:
        "A database statement failed while preparing the run. This is not a transient provider fault, so retrying won't help — an operator must investigate the database before re-running.",
      primaryAction: "investigate_db",
      announce: "assertive",
    };
  }

  // unknown / exhausted
  return {
    tone: "danger",
    title: "Model service unavailable",
    message:
      "The AI model service was temporarily unavailable and didn't recover after automatic retries. Your request was not lost — you can re-run it.",
    primaryAction: "retry_now",
    announce: "assertive",
  };
}
