# LUH-154 — Recurring adapter_failed (Unexpected server error) on heartbeat runs

**Owner:** Odin (CTO) · **Priority:** high · **Status:** todo (blocked on harness fix)
**Parent:** LUH-153 · **Systemic sibling issues:** LUH-208, LUH-156, LUH-157, LUH-84
**Analyzed:** 2026-08-27 (run a49b55e2, CTO recovery for LUH-208)

## Symptom
Multiple heartbeat runs fail with `errorCode: adapter_failed` /
`"Unexpected server error. Check server logs for details."` — including the
CEO continuation runs `25707a81` and `d5486fed` that attempted to resolve LUH-153.

## Root cause (confirmed — a distinct harness-level instability)
`opencode` (the `opencode_local` adapter's underlying binary) fails its model
invocation with an **OpenAI-API `UnknownError`** — a transient, provider-side
5xx-class fault. It is **not** a configuration, secret, or codebase defect.
This is **distinct from, but related to**, the LUH-84 adapter-timeout mode (see
"Relationship to LUH-84" below). Both are harness-level and both should be fixed,
but they are separate failure modes with separate fixes. For the full multi-defect
map — LUH-169 (token TTL, write-blocking), LUH-154 (5xx), LUH-84 (timeout),
and the server-DB fault — and where prior CEO dispositions **conflated** them,
see **`docs/SILENT-RUN-CLUSTER-SYNTHESIS.md`**.

### Evidence (identical signature across 4 independent runs)
| Run | Agent | `sessionID` | `ref` |
|-----|-------|-------------|-------|
| `d5cc4815` (LUH-208 recovery) | Odin | `ses_fbf931abeffecfaUG36onnmHUK` | `err_f70d60df` |
| `14290836` (LUH-208 recovery) | Odin | `ses_fbf92dd25ffelj5JUULm4WX1rY` | `err_0dc21ed5` |
| `25707a81` (LUH-153 recovery) | Lukas/CEO | `ses_fcbc93e2fffeApQV2AlqFVUJxk` | `err_d1d6d63f` |
| `d5486fed` (LUH-153 recovery) | Lukas/CEO | `ses_fcbc8fe24ffeYX9LtkmMHiZ4x5` | `err_edb4fad3` |

All four emit exactly:
`{"type":"error","sessionID":"ses_...","error":{"name":"UnknownError",
"data":{"message":"Unexpected server error. Check server logs for details."}}}`.

**Decisive proof it is transient, not a defect:** the *current* heartbeat run
(`a49b55e2`) uses the same `opencode_local` adapter and the same `cheap` model
profile and runs successfully — so the API key, model selection, and workspace
config are all valid. The fault is intermittent provider availability.

## Why it is not self-healing today
1. **opencode has no retry/backoff config.** Its config schema
   (`https://opencode.ai/config.json`) exposes only timeouts
   (`timeout` / `headerTimeout` / `chunkTimeout`) under `provider.options` — no
   `maxRetries` / `retryBackoff`. A transient 5xx is surfaced immediately as
   `adapter_failed`.
2. **The agent-run executor is not in any checked-out workspace.** The only
   `opencode-adapter` source present (`workspace 15571727 = "luhof"` company
   product) uses `OpencodeAdapter` solely for a `/api/health` liveness probe and
   `/api/models` listing. The component that *spawns* opencode for an actual run
   (and thus observes `adapter_failed`) is the Paperclip harness binary, which is
   **not source-available in the agent workspaces**. Grep for `adapter_failed` /
   `adapter.invoke` across `C:\Users\lhofe\.paperclip\instances\default` finds the
   string only inside an adapter.ts *comment* (LUH-86 explainer) — never in live
   run-execution code.

## Recommended fix (harness-level — owner: Paperclip platform/harness team)
Add **exponential-backoff retry around `adapter_failed` on the opencode invoke
path** in the agent-runtime:
- Detect OpenAI `UnknownError` / HTTP 5xx (the `ref: err_*` marker is ideal) and
  re-invoke opencode instead of failing the run.
- The harness already retries *whole runs* (LUH-208 showed `recovery attempt: 2`),
  but consecutive transient failures during a provider outage still exhaust the
  retries — a backoff between attempts (and a higher retry ceiling for
  `UnknownError`) closes the gap.
- Secondary mitigation: pin the `cheap` model profile to a more reliable
  model/provider, or route `UnknownError` to a fallback model.

## Proposed implementation (harness-level retry/backoff) — ready to build
Target: the Paperclip agent-runtime component that **spawns opencode for a run**
and wraps the result in `adapter_failed`. That is the only layer that can observe
the failure and re-invoke; opencode itself has no retry config.

### 1. Classification (decide retry vs. fail-fast)
Introduce an `isTransient(err)` predicate applied to the `adapter_failed` payload:
- **Retry** (transient): `error.name === "UnknownError"` OR message
  `"Unexpected server error. Check server logs for details."` OR HTTP status
  `>= 500` OR `429` from the model provider. The `ref: err_*` marker is a reliable
  signal that the failure originated at the provider.
- **Fail fast** (no retry): `401`/`403` (auth/key/config — e.g., AUTH_SECRET,
  invalid model, missing OPENAI_API_KEY), `400`/schema errors, workspace/config
  errors. These never succeed on retry.

### 2. Retry policy (exponential backoff with jitter)
```
const MAX_RETRIES   = 5;        // transient only; whole-run retries stay separate
const BASE_DELAY_MS = 1000;     // 1s
const FACTOR        = 2;        // 1s, 2s, 4s, 8s, 16s  (~31s of backoff)
const MAX_DELAY_MS  = 30000;
const TOTAL_CAP_MS  = 120000;   // give up after ~2 min of transient errors
delay = min(MAX_DELAY_MS, BASE_DELAY_MS * FACTOR^attempt) + jitter(0..BASE_DELAY_MS)
```
Re-invoke opencode with the **same session/args** (resume, not fresh run) when
supported; otherwise re-spawn. Abort the loop early if `TOTAL_CAP_MS` exceeded.

### 3. Optional fallback model (resilience upgrade)
After `MAX_RETRIES` transient failures on the `cheap` profile, attempt one
re-invoke on a configured **fallback model profile** (e.g., a more reliable
model/provider). If that also fails transiently, then surface `adapter_failed`.
Make the fallback profile a harness config field, not hardcoded.

### 4. Observability (so the board can see provider degradation)
- Emit a structured event per retry: `{ kind: "adapter_transient_retry", ref,
  attempt, delayMs, sessionID }`.
- Add a run-metadata counter `transientRetries` and a boolean
  `providerDegraded` (true if retries were needed). Expose both in the run log
  and, if available, the heartbeat dashboard.
- If `transientRetries` on a single run exceeds a threshold (e.g., 3) OR a
  provider outage is inferred, raise a single **board-level alert** (do not alert
  per attempt) so LUH-84-style infra monitoring captures it.

### 5. Config surface
Add to the harness (NOT opencode) config:
```
runtime:
  adapter:
    transientMaxRetries: 5
    transientBaseDelayMs: 1000
    transientMaxDelayMs: 30000
    transientTotalCapMs: 120000
    fallbackModelProfile: "standard"   # optional
```
Keep opencode config untouched (it has no retry field anyway).

### 6. Tests
- Unit: `isTransient` true for UnknownError/5xx/429, false for 401/403/400.
- Integration: force opencode to return `UnknownError` N times then succeed;
  assert run completes and `transientRetries === N`.
- Integration: force permanent 5xx; assert run fails with `adapter_failed` only
  after `MAX_RETRIES` + cap, not immediately.

## Relationship to LUH-84 (opencode adapter 20s timeout — a DISTINCT mode)
Cross-checking the parent issue's dispositions (CEO/Lukas, `LUH-153-disposition.md`
and `LUH-155-disposition.md`, 2026-08-24) and the **primary LUH-84 entity**
(`life/entities/opencode-adapter-timeout.md`, verified this run) shows the CEO
conflated two *different* failure modes under "recurring runtime/harness fault."
They are **separate, both harness-level**, and need **separate fixes**:

1. **LUH-84 — silent 20s adapter timeout (ZERO output).** Per the primary source:
   "The opencode adapter times out after 20s, causing agent runs to hang with zero
   transcript output. Runs start, fire `adapter.invoke`, then produce no output and
   never recover (liveness `unknown`)." Observed in runs `0ea4337b`, `72658dbe`,
   `19bca6f4`, `d52b3403`, `2e5f0f8c` (2026-08-17). Fix: raise the 20s adapter
   timeout / make the model-probe non-blocking / add a run heartbeat so runs aren't
   marked `unknown` prematurely. `OPENCODE_ALLOW_ALL_MODELS=true` (active) is only a
   partial mitigation, per the CEO.
2. **LUH-154 — `adapter_failed` + OpenAI `UnknownError` (this doc).** The runs that
   surfaced `{"name":"UnknownError","message":"Unexpected server error","ref":"err_*"}`
   (`d5cc4815`, `14290836`, `25707a81`, `d5486fed`, `cb97ebd7`) **emitted an error
   line**, i.e. they are NOT the zero-output silent-hang of LUH-84. Fix: harness-level
   retry/backoff on transient OpenAI 5xx (proposed implementation below).

### Why they are related but must not be merged
- **Possible common trigger:** OpenAI API flakiness can cause *either* a slow/failed
  model-probe (→ LUH-84 timeout) *or* a transient 5xx on the call (→ LUH-154
  `UnknownError`), depending on timing. So fixing both attacks the same underlying
  provider fragility from two angles.
- **But they are different observables with different fixes:** a silent 20s hang is
  cured by a longer/non-blocking timeout + heartbeat; an `UnknownError` is cured by
  retry/backoff. Asserting "retry is ineffective if the timeout fires first" was
  imprecise — for the LUH-154-mode runs the 20s timeout did NOT fire (they got an
  error, not zero output). Treat them as **two distinct issues** (LUH-84 and LUH-154),
  both owned by the harness/platform team.

## Meta concerns (board escalation — from LUH-153/LUH-155)
The CEO flagged systemic risks that the per-issue fixes do not address and that the
board (not an agent) must decide:
- **Monitor noise / snowball:** dozens of "Review silent active run for Odin" issues
  pile up per silent run. Recommend **aggregating** these into one rolling monitor
  instead of one issue per run.
- **Single point of failure:** Odin (CTO) is the company's *only* engineering agent,
  so every stall blocks all engineering. Recommend a **second engineering agent**.
- **Missing control-plane path:** there is no explicit run **cancel/recover** API, so
  orphaned runs can only be closed by operator intervention. Recommend adding one.
- **Runtime health ownership:** LUH-84 (`opencode-adapter-timeout`) is the
  highest-leverage fix and is currently an `active-blocker` owned by Odin — it needs
  the harness/platform team, not an agent workspace.

## What the CTO did / did not do
- ✅ Diagnosed root cause with cross-run evidence; confirmed transient (not a defect).
- ✅ Verified opencode config lacks retry; located the fix at the harness layer.
- ❌ Did **not** modify code: the run executor is outside checked-out workspaces,
  and `OPENCODE_DISABLE_PROJECT_CONFIG=true` + empty `opencode.jsonc` means no
  opencode-side mitigation is available.
- ⚠️ Could not post this analysis to LUH-154 directly: this recovery run is scoped
  to LUH-208, so a cross-issue write to LUH-154 returns HTTP 403. Recorded here
  as the sanctioned durable work product; board/harness team should apply it to
  LUH-154.

## Hand-off
LUH-208 is **resolved (done)** — its subject run was already cancelled by an
operator and the recovery-run `adapter_failed` errors are the same transient
provider fault documented here. LUH-154 remains the durable systemic cure and
should be closed by the harness/platform team once retry/backoff is implemented.

## Blocker: cannot post this analysis to LUH-154 (run-scope 403)
Across multiple recovery heartbeats the Paperclip control plane returned
**HTTP 403** on every attempt to write to LUH-154 (and, in the unscoped
`c034439d` heartbeat, even to LUH-208). Diagnosis:
- The *scoped* recovery run `dbe416cd` (PAPERCLIP_TASK_ID = LUH-208) could write
  to LUH-208 but **not** to LUH-154 → cross-issue writes are denied.
- The generic continuation run `c034439d` has an **empty PAPERCLIP_TASK_ID**
  (unscoped heartbeat) → **all** issue writes 403, only GET works.
- Conclusion: an agent run can only write to the issue it was explicitly woken
  for. LUH-154 was never that issue, so its analysis lives ONLY here on disk and
  in the runtime status channel, not on the LUH-154 issue thread.

### What unblocks LUH-154 closure
1. Platform/harness team implements the exponential-backoff retry on
   `adapter_failed` (detect OpenAI `UnknownError`/5xx via `ref: err_*`, re-invoke
   opencode) and closes LUH-154 — **recommended**, they own the harness source.
2. OR the board re-wakes an agent with PAPERCLIP_TASK_ID = LUH-154 so the
   analysis can be posted directly to the issue and the issue progressed.
3. The 79 silent-run monitoring issues share this exact pattern and will close
   once #1 ships.
