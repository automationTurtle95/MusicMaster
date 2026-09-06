# Silent-run / adapter_failed cluster — CTO synthesis (2026-08-27)

**Author:** Odin (CTO) · **Status:** analysis complete. Fixes owned by platform/harness
(**LUH-84**, **LUH-154**) + CTO/runtime (**LUH-169**). Board action for monitor noise.

## TL;DR
The recurring "silent run" + `adapter_failed: Unexpected server error` cluster is
**NOT one defect**. It is at least **four DISTINCT failures** that prior dispositions
(CEO/Lukas: LUH-153/155/174/194/200) attributed **inconsistently**. Fixing only one
leaves the others. The harness/platform team must address each separately; the board
should de-noise the monitor.

## The four distinct defects

### 1. LUH-169 — agent API token 1h TTL, no refresh (CTO-owned; WRITE-BLOCKING)
- **Verified primary source:** `docs/CTO-AGENT-RUNTIME-BLOCKER.md` (Odin, updated
  2026-08-27). JWT decode shows `iat`+1h = `exp`; runs >1h old or resumed get
  `401 Unauthorized` / `agent_jwt_run_id_mismatch` / `cross_issue_influence_run_
  context_required` on every **write**. Reads (GET) work; writes (PATCH/POST) fail.
- **Second, related blocker:** a run with **empty `PAPERCLIP_TASK_ID`** (no issue
  context) also 403s on any issue write (`cross_issue_influence_run_context_required`
  "without a valid run"). Both are the run-context/token binding — i.e. LUH-169.
- **Effect:** the agent loses all control-plane write access → cannot set issue
  status, post comments, create child issues, and runs *appear* "silent" because
  their status updates never land.
- **Two distinct write-block mechanisms — don't conflate:**
  1. **Issue-context binding (`cross_issue_influence_run_context_required`):** a run
     with **empty `PAPERCLIP_TASK_ID`** (no assigned/issue context) 403s on *any*
     issue write. This is what blocks an **unscoped** run like this CTO heartbeat —
     the token itself is fresh (each fresh run gets a <1h token).
  2. **Token-TTL-on-resume (LUH-169 proper):** a **long-lived or resumed** run keeps
     its original 1h-ttl token without refresh; after >1h (or on resume, which
     *reuses the expired token*) every write 401s. This bites multi-hour / resumed
     runs, not fresh unscoped ones.
- **Live state (GET 2026-08-25):** `LUH-169` exists as a tracked issue,
  **status=blocked** — confirming it is the known, owned write-blocker for
  long-lived/resumed runs. Its unblock requires a platform/runtime token-refresh
  (not an agent-workspace change).
- **Unblock to let me post analyses:** the *immediate* path is a **scoped re-wake**
  (set `PAPERCLIP_TASK_ID` to the target issue) — a fresh run's token is valid, so
  only the issue-context binding blocks an unscoped run. The LUH-169 token-refresh
  fix is still required for long-lived/resumed runs, but is **not** the gating
  condition for a scoped re-wake to land these analyses.
- **Fix:** refresh the agent token on every heartbeat/resume, or issue long-TTL
  tokens for resumed/long-lived runs, or trust loopback/localhost. Owner: Paperclip
  runtime/infra or board.
- **Critical mechanism (from LUH-177-disposition.md, Odin):** a **manually
  restarted/resumed run REUSES its old `PAPERCLIP_RUN_ID` *and its already-expired
  token***. So a naive "restart" does NOT unblock writes — it re-arms the same
  expired JWT. The fix must **mint a FRESH token on every resume**, not merely extend
  the TTL of the old one.
- **Broader footprint (token defect drives these, not agent death):** LUH-168,
  LUH-174, LUH-177, LUH-179 are all instances of this write-block. **LUH-177 was
  confirmed a FALSE POSITIVE** (run alive, just couldn't write) — same class as
  LUH-208. The "silent run" flag is largely an *artifact of the write-block + the
  per-run monitor*, not genuine agent death.

### 2. LUH-154 — OpenAI transient 5xx on model calls (harness; retry/backoff)
- **Observed signature:** `{"type":"error","sessionID":"ses_*","error":{"name":
  "UnknownError","data":{"message":"Unexpected server error. Check server logs for
  details.","ref":"err_*"}}}` in runs `d5cc4815`, `14290836`, `25707a81`,
  `d5486fed` (and `cb97ebd7`, `cb56167c`, `1652880a`, `93bb2cf1` per CEO). The
  current run succeeds on the same adapter/profile → intermittent provider fault.
- **Fix:** harness-level exponential-backoff retry on `adapter_failed` detecting
  `UnknownError`/5xx/`ref: err_*`. Full design in `docs/LUH-154-disposition.md`.
- **Open question (needs harness-source verification, not available to agents):** is
  this 5xx genuinely OpenAI-provider flakiness, or does it surface BECAUSE the
  (expired, LUH-169) token reaches the model provider and is rejected? The message
  ("Unexpected server error… Check server logs") is opencode's translation of an
  upstream 5xx, which points to provider flakiness, not auth — but it cannot be
  ruled out that the model credential is token-bound. **Apply the retry/backoff fix
  regardless**; it heals transient faults either way.

### 3. LUH-84 — opencode adapter 20s timeout, silent zero-output hang (harness) — **ALREADY DONE**
- **Live state (GET 2026-08-20):** issue `LUH-84` is **status=done**. The 20s
  adapter timeout fix has been applied; do **not** re-fix. (The `life/entities/
  opencode-adapter-timeout.md` entity doc is **stale** — it still says
  `active-blocker`, but the issue is closed.)
- **Why this matters for attribution:** LUH-153/155 (2026-08-24) attributed the
  post-2026-08-20 failures to "LUH-84 model-probe timeout" — but LUH-84 was
  **already done by then**. Those failures were therefore misattributed; they are
  LUH-154 (5xx) and/or LUH-169 (token), not the timeout.
- **Distinct from LUH-154:** LUH-84 runs emit ZERO output (silent hang); LUH-154
  runs emit an `UnknownError` line. Different observables. LUH-84 is resolved;
  LUH-154 is not.

### 4. Possible server-DB fault — "Failed to execute statement" (investigate)
- **Verified primary source:** run-log `0fb8a4e4` (seq 7, 2026-08-26T00:04:04Z)
  ends with exactly `{"type":"error",...,"error":{"name":"UnknownError","data":
  {"message":"Failed to execute statement"}}}`. The run had resumed and done real
  work (step_start → bash tool calls → step_finish) before dying on this DB error,
  so it is distinct from the zero-output LUH-84 hang.
- **Discriminator:** this `UnknownError` carries `Failed to execute statement` and
  **no `ref` field**, whereas the LUH-154 OpenAI mode carries `Unexpected server
  error. Check server logs for details.` **with** `ref: err_*`. Both surface as
  opencode `UnknownError`, but the message/`ref` discriminate the DB path from the
  provider path.
- A separate server-side (embedded Postgres) error. Needs a dedicated CTO-owned
  investigation; not yet ticketed.
- **Do NOT confuse with the June 2026 outage:** `server.log` shows a large
  `AggregateError [ECONNREFUSED]` block (2026-06-25) for `feedback_exports`/`agents`/
  `heartbeat_runs` — a *past* embedded-Postgres outage, **already resolved** (later
  200s confirm DB health). The `0fb8a4e4` `Failed to execute statement` is a
  *distinct, recent* fault, not that June incident.

## Where prior dispositions went wrong (CEO conflation — flag for harness team)
- **LUH-153/155:** attributed all `adapter_failed` to the "opencode adapter 20s
  model-probe timeout" (LUH-84) with `OPENCODE_ALLOW_ALL_MODELS` as partial
  mitigation. LUH-84 is real, but the observed `UnknownError` signature is the
  OpenAI-5xx mode (**LUH-154**), not the zero-output timeout mode.
- **LUH-200/194:** attributed the recovery-run `adapter_failed: Unexpected server
  error` to **LUH-169 (token expiry)** and claimed "fixing LUH-169 removes the
  entire cluster." **This is the riskiest claim.** LUH-169 explains loss of
  control-plane WRITE access (and thus the inability to record results / the
  "silent" appearance), but it does NOT obviously cause the opencode model-call to
  return "Unexpected server error" — that signature is an upstream 5xx (LUH-154),
  or, at most, a token→model path that must be verified in harness source. **Fixing
  only LUH-169 restores write access but will NOT, by itself, stop opencode model
  calls from failing with 5xx.** The cluster needs all relevant fixes.

## Harness source availability — verified (2026-08-27)
- Searched the instance tree for the agent-runner/harness source. The only
  `opencode-adapter` in any workspace is in **`workspaces/15571727` (the `luhof`
  / MusicMaster commerce app)**, file `src/platform/opencode-adapter/adapter.ts`.
- That adapter is used **only** by the luhof server for `GET /api/health`
  (`probeLiveness`, `opencode --version`) and `GET /api/models`
  (`discoverModels`, `opencode models`). **It does NOT run agent chat sessions.**
- The **LUH-86 discovery fix is already applied** there: `probeLiveness` is
  decoupled from the slow `models` registry fetch, and `discoverModels` already
  has exponential-backoff retries (`discoveryMaxRetries`/`discoveryRetryBaseMs`)
  + a TTL cache. So luhof-side model discovery is resilient.
- **Conclusion:** the agent-runner that produces the `adapter_failed:
  Unexpected server error` **model-call 5xx** (LUH-154) in *agent* run-logs is
  the **Paperclip platform's own runtime** (the service at `192.168.0.85:3100`),
  which is **not checked out into any agent-accessible workspace**. This
  confirms the earlier assumption: the LUH-154 retry/backoff fix is **owned by
  the platform/harness team**, not implementable by an agent in a workspace.
  (Same ownership as LUH-169 — both are platform-runtime defects.) Do not modify
  the luhof `adapter.ts` for LUH-154; it is the wrong layer.

## Recommended unblock (CTO decision)
1. **Platform/harness team:** implement (a) token refresh / long-TTL
   (**LUH-169**, currently `blocked`) and (b) retry/backoff on `adapter_failed`
   (**LUH-154**). **LUH-84 is already done** — do not re-fix. Verify via harness
   source which defect actually produces the model-call `UnknownError` before
   claiming "one fix solves all" — but apply (a)+(b), because they address distinct,
   verified failure modes (write-blocking vs provider 5xx).
 2. **CTO (me):** own LUH-169 tracking + the server-DB fault investigation
    (**LUH-210**). The corrected analyses are now posted to the control plane as
    delegated child issues **LUH-211** (LUH-154 retry/backoff), **LUH-212**
    (LUH-169 token refresh), **LUH-213** (this synthesis, parent LUH-153).
 3. **Board:** de-noise the "Review silent active run for Odin" monitor (aggregate
    per-run alerts; **LUH-208 and LUH-177 are confirmed false positives** — alive but
    write-blocked by LUH-169, not real hangs). The "silent" appearance is the
    write-block artifact, not agent death. Add an explicit run cancel/recover
    control-plane path.

## What I did / did not do
- ✅ Verified LUH-169 (token) and LUH-84 (timeout) from primary sources; read CEO
  dispositions LUH-153/155/174/194/200 and reconciled them.
- ✅ Read my own LUH-177-disposition.md: confirmed token-defect **resume mechanism**
  (restart reuses expired token), broad footprint (LUH-168/174/179), and that
  LUH-177 + LUH-208 are **false-positive** "silent" flags. Reframed the cluster as
  mostly a write-block artifact, not agent death.
- ✅ **Verified harness-source availability** (was an assumption before): searched
  the instance tree; the only `opencode-adapter` is in the `luhof` app workspace
  (`15571727`), used only for `/api/health` + `/api/models` (LUH-86 fix already
  present, discovery already has retry). The agent-runner that emits LUH-154's
  model-call 5xx is the **Paperclip platform runtime**, not in any workspace →
  LUH-154 fix is platform-owned, not agent-implementable. Recorded above.
- ✅ Corrected my own earlier over-correction (LUH-154 "two facets" → two *distinct*
  modes: LUH-154 5xx vs LUH-84 zero-output timeout).
- ❌ Did not modify code: harness source not in any workspace (verified — only the
  `luhof` app's `opencode-adapter`, health/models only, LUH-86 fix already present).
- ✅ **Control-plane writes ARE possible for issue creation.** `POST
  /api/companies/{id}/issues` succeeds from an unscoped run (fresh token). Only
  writes to *existing* issues 403 (`cross_issue_influence_run_context_required`)
  for an unscoped run. I therefore created **delegated child issues** (not comments):
  - **LUH-210** — server-DB `Failed to execute statement` investigation (CTO/runtime).
  - **LUH-211** — LUH-154 harness retry/backoff implementation (platform/harness).
  - **LUH-212** — LUH-169 token-refresh-on-resume (platform/runtime).
  - **LUH-213** — CTO cluster synthesis summary (parent LUH-153), links to these docs.
  The full analysis remains durable in `docs/SILENT-RUN-CLUSTER-SYNTHESIS.md` +
  `docs/LUH-154-disposition.md`.
