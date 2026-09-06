import { describe, it, expect } from "vitest";
import {
  classifyFailure,
  isTransient,
  nextBackoffDelay,
  describeOperatorStatus,
  RetryPolicy,
  type AdapterFailedPayload,
  type FailureClass,
} from "@/lib/agent-runtime/transient-failure";

const base = (over: Partial<AdapterFailedPayload["error"]> = {}): AdapterFailedPayload => ({
  type: "error",
  sessionID: "ses_test",
  error: { name: "UnknownError", message: "Unexpected server error. Check server logs for details.", ...over },
});

describe("classifyFailure — LUH-154 vs LUH-210 discriminator", () => {
  it("treats OpenAI UnknownError as transient (LUH-154)", () => {
    expect(classifyFailure(base())).toBe("transient");
    expect(isTransient(base())).toBe(true);
  });

  it("treats 'Unexpected server error' WITH ref: err_* as transient", () => {
    expect(classifyFailure(base({ ref: "err_f70d60df" }))).toBe("transient");
  });

  it("treats HTTP 5xx as transient", () => {
    expect(classifyFailure(base({ status: 503 }))).toBe("transient");
    expect(classifyFailure(base({ status: 500 }))).toBe("transient");
  });

  it("treats HTTP 429 (rate limit) as transient", () => {
    expect(classifyFailure(base({ status: 429 }))).toBe("transient");
  });

  it("LUH-231 — OpenRouter free-tier rate limit (statusCode in data, APIError name) as transient", () => {
    // Exact shape from run dd4d7e7c (2026-08-27) — the provider_quota_recovery case.
    const openRouter429: AdapterFailedPayload = {
      type: "error",
      sessionID: "ses_fba8b6c48ffeIgd6aVbFe9m23d",
      error: {
        name: "APIError",
        data: {
          message: "Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day",
          statusCode: 429,
          isRetryable: true,
          metadata: {
            limit_source: "openrouter_free_tier_daily",
            remedy_hint: "Wait for the daily reset, or purchase credits.",
          },
        },
      },
    };
    expect(classifyFailure(openRouter429)).toBe("transient");
    expect(isTransient(openRouter429)).toBe(true);
  });

  it("LUH-231 — rate-limit message + isRetryable without explicit status as transient", () => {
    const payload: AdapterFailedPayload = {
      type: "error",
      error: {
        name: "APIError",
        data: { message: "429 Too Many Requests — free-models-per-day exhausted", isRetryable: true },
      },
    };
    expect(classifyFailure(payload)).toBe("transient");
  });

  it("does NOT treat rate-limit message with isRetryable:false as transient", () => {
    const payload: AdapterFailedPayload = {
      type: "error",
      error: {
        data: { message: "Rate limit exceeded", isRetryable: false },
      },
    };
    expect(classifyFailure(payload)).toBe("unknown");
  });

  it("LUH-210 — 'Failed to execute statement' with NO ref is a DB fault, NOT transient", () => {
    const fc: FailureClass = classifyFailure(
      base({ name: "UnknownError", message: "Failed to execute statement", ref: undefined }),
    );
    expect(fc).toBe("db_fault");
    expect(isTransient(base({ name: "UnknownError", message: "Failed to execute statement" }))).toBe(false);
  });

  it("does NOT conflate LUH-210 (DB, no ref) with LUH-154 (5xx, ref:err_*)", () => {
    const db = classifyFailure(base({ message: "Failed to execute statement", ref: undefined }));
    const fivexx = classifyFailure(base({ message: "Unexpected server error", ref: "err_abc" }));
    expect(db).toBe("db_fault");
    expect(fivexx).toBe("transient");
    expect(db).not.toBe(fivexx);
  });

  it("treats 401/403/400 as auth_config (fail fast)", () => {
    expect(classifyFailure(base({ status: 401 }))).toBe("auth_config");
    expect(classifyFailure(base({ status: 403 }))).toBe("auth_config");
    expect(classifyFailure(base({ status: 400 }))).toBe("auth_config");
  });

  it("does not retry unknown/ambiguous failures", () => {
    expect(classifyFailure(base({ name: "SomeError", message: "weird thing" }))).toBe("unknown");
    expect(isTransient(base({ name: "SomeError", message: "weird thing" }))).toBe(false);
  });
});

describe("nextBackoffDelay — exponential backoff with jitter", () => {
  const seq = [0, 1, 2, 3, 4].map((a) => nextBackoffDelay(a, RetryPolicy, () => 0));
  it("grows by FACTOR per attempt (no jitter floor)", () => {
    expect(seq[0]).toBe(1000);
    expect(seq[1]).toBe(2000);
    expect(seq[2]).toBe(4000);
    expect(seq[3]).toBe(8000);
    expect(seq[4]).toBe(16000);
  });

  it("never exceeds MAX_DELAY_MS even at high attempts", () => {
    for (let a = 5; a < 20; a++) {
      expect(nextBackoffDelay(a)).toBeLessThanOrEqual(RetryPolicy.MAX_DELAY_MS + RetryPolicy.JITTER_MS);
    }
  });

  it("stays within the capped + jitter window (full jitter)", () => {
    for (let i = 0; i < 50; i++) {
      const d = nextBackoffDelay(2);
      expect(d).toBeGreaterThanOrEqual(4000);
      expect(d).toBeLessThanOrEqual(RetryPolicy.MAX_DELAY_MS + RetryPolicy.JITTER_MS);
    }
  });
});

describe("describeOperatorStatus — operator-facing UX bridge", () => {
  it("frames a transient retry as safe + passive (no action needed)", () => {
    const s = describeOperatorStatus({
      failureClass: "transient",
      attempt: 1,
      nextDelayMs: 2000,
      recovered: false,
      maxRetries: RetryPolicy.MAX_RETRIES,
    });
    expect(s.tone).toBe("info");
    expect(s.primaryAction).toBeNull();
    expect(s.announce).toBe("polite");
    expect(s.message.toLowerCase()).toContain("don't need to do anything");
  });

  it("escalates tone as retries run low", () => {
    const last = describeOperatorStatus({
      failureClass: "transient",
      attempt: 4,
      nextDelayMs: 16000,
      recovered: false,
      maxRetries: 5,
    });
    expect(last.tone).toBe("warning");
  });

  it("recovers with a positive end state (Peak-End rule)", () => {
    const s = describeOperatorStatus({
      failureClass: "transient",
      attempt: 2,
      nextDelayMs: 0,
      recovered: true,
      maxRetries: 5,
    });
    expect(s.tone).toBe("success");
    expect(s.announce).toBe("assertive");
  });

  it("offers fix_config (NOT retry) for auth faults", () => {
    const s = describeOperatorStatus({
      failureClass: "auth_config",
      attempt: 0,
      nextDelayMs: 0,
      recovered: false,
      maxRetries: 5,
    });
    expect(s.primaryAction).toBe("fix_config");
    expect(s.message.toLowerCase()).not.toContain("retrying automatically");
  });

  it("offers investigate_db (NOT retry) for the LUH-210 DB fault", () => {
    const s = describeOperatorStatus({
      failureClass: "db_fault",
      attempt: 0,
      nextDelayMs: 0,
      recovered: false,
      maxRetries: 5,
    });
    expect(s.primaryAction).toBe("investigate_db");
  });
});
