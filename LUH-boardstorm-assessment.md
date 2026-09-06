# LUH Board-Storm — CTO Assessment (UPDATED, run b93d18f6 — corrected)

**Run:** b93d18f6-c15a-4f9f-8d8a-... (manual Control Center start, unassigned)
**Date:** 2026-08-30
**Scope:** ALL `stale_active_run_evaluation` issues (the watchdog family), not just LUH-247/249/250/251/252/253

## TL;DR

The `stale_active_run_evaluation` watchdog has generated a **board storm of 105 issues**
(90 still open). The overwhelming majority (**87 of 90 open**) are **false positives** — the
subject run already terminated (cancelled by board operator or succeeded). Only **3 are genuine
failures**: LUH-145 + LUH-190 are the **runtime-Postgres terminal result-write failure** already
tracked in **LUH-210/238** (confirmed by the no-`ref` `Failed to execute statement` signature), and
LUH-48 is the **provider/server 5xx** class tracked in **LUH-154** (`ref: err_62914a2d`). The shared
`errorCode=adapter_failed` is just the OpenCode envelope — these are two tracked platform defects,
**not a new agent-code defect and not a misdiagnosis as a single "DB vs adapter" either/or.**

This storm is the true root cause of the chronic `provider_quota` failures: every open issue
re-arms a `stranded_assigned_issue` recovery loop on each daily quota reset, burning the scarce
`free-models-per-day` budget and starving real work.

## Scope (verified via authoritative server API)

| Metric | Count |
|--------|-------|
| Total `stale_active_run_evaluation` issues | 105 |
| Open (backlog 73 / blocked 16 / in_progress 1) | **90** |
| Done | 12 |
| Cancelled | 3 |
| Open assigned to Odin (me) | 58 |
| Open assigned to Lukas | 32 |
| Open unassigned | 0 |

## Subject-run status of the 90 open alerts (read from `GET /api/heartbeat-runs/{id}`)

- **87 FALSE POSITIVES** — subject run `cancelled` (by board operator) or `succeeded` (terminal).
  No stuck process, no resource leak, no remediation needed. Examples verified: LUH-251 run
  *succeeded*; LUH-250/248/246/126/127/131/133/128 all *cancelled by board operator*.
- **3 GENUINE FAILURES** (subject run `failed`) — two distinct, already-tracked runtime defects:
  - **LUH-145** (run `bcddf199-3275-4d7b-bcfc-34d57a8ae523`, prior Odin): `Failed to execute statement`, `errorCode=adapter_failed`, no `ref` → **runtime-Postgres terminal result-write failure** (LUH-210 class).
  - **LUH-190** (run `0c0db503-9c72-4eb8-9aac-54b83032b385`, Lukas `438b1c89`): `Failed to execute statement`, `errorCode=adapter_failed`, no `ref` → same **LUH-210** class.
  - **LUH-48** (run `37989026-9f35-4e98-b54c-c7c781f74b6e`, agent `15571727`): `Unexpected server error`, `errorCode=adapter_failed`, **`ref: err_62914a2d`** → **provider/server 5xx** (LUH-154 class).

> RECONCILED (2026-08-30, run a2904fba): an earlier draft called these "not a DB defect / adapter
> crash." That is **withdrawn** on reconciliation with the established `docs/LUH-210-DB-RCA.md`:
> - `Failed to execute statement` (no `ref`) **IS** a runtime-Postgres terminal run-result write
>   failure (LUH-210, H1–H5: constraint/serialization/migration/payload/txn-timeout). The
>   `errorCode=adapter_failed` is just the OpenCode envelope; the inner cause is the Postgres write.
> - `Unexpected server error` + `ref: err_*` (LUH-48) is the **provider 5xx** class (LUH-154) — a
>   different defect.
> - The server DB serving reads fine is consistent with LUH-210 (already-open connection, terminal
>   write fails) — it does NOT mean "no DB defect." The Windows `.cmd` silent-hang (LUH-156/157/84)
>   is a *separate* silent-run class and is not the cause here.
> Full reconciled analysis: **`LUH-adapter-failure-rca.md`**.

### Key signal: the 3 genuine failures are two tracked platform defects, not a new "adapter" bug
- LUH-145 + LUH-190 → **LUH-210 / LUH-238** (runtime-Postgres result-write; platform-owned; needs
  Postgres `SQLSTATE` from server log). Do NOT open a duplicate "DB error" issue.
- LUH-48 → **LUH-154** (provider 5xx retry/backoff).
The shared `adapter_failed` envelope is the OpenCode adapter reporting an inner runtime/platform
fault — not a new, separate defect to investigate from scratch.

## Why the agent cannot auto-clear these from this run

This run (cfb4f1d9) is **unassigned** (`issueId: null`). Mutating writes are blocked:
- `PATCH /api/issues/{id} {status:done}` → **HTTP 403** (`cross_issue_influence_run_context_required`)
- `POST /api/issues/{id}/checkout` → **HTTP 400**
- `POST /api/issues/{id}/interactions` → **HTTP 400**

Prior run 98e616ad proved closure IS possible when the run is **properly checked out** to the
issue AND the recovery monitor window has elapsed (LUH-247 closed via PATCH 200). So a
properly-attributed recovery sweep can clear the 87 false positives.

## Recommended actions (owner = Board / human, NOT agent-executable from unassigned context)

1. **Bulk-close the 87 false positives** as `done (false_positive)`:
   - Either via Board/UI multi-select, OR
   - via a single properly-attributed sweep run (like 98e616ad) that is checked out to each issue
     after its recovery monitor window elapses — proven to succeed via PATCH 200.
   This immediately stops 87 recovery loops from re-firing on quota reset.

2. **Route the genuine failures to their already-tracked owners (do NOT open duplicate issues):**
   - **LUH-145 + LUH-190** (`Failed to execute statement`, no `ref`) → link under **LUH-210 / LUH-238**.
     Per the established `docs/LUH-210-DB-RCA.md` this is a **runtime-Postgres terminal run-result
     write failure** (H1–H5: constraint/serialization/migration/payload/txn-timeout). The fix is
     **platform/harness-owned** (runtime source is not in any agent workspace); the platform must
     capture the Postgres `SQLSTATE` from the server log to disambiguate. The healthy-DB-for-reads
     observation is consistent with LUH-210 (already-open connection, terminal write fails).
   - **LUH-48** (`Unexpected server error`, `ref: err_62914a2d`) → link under **LUH-154** (provider 5xx
     retry/backoff).
   - Re-run/repair the failed runs once the respective platform fix lands.

3. **Fix the watchdog (systemic, LUH-256):**
   - `stale_active_run_evaluation` must ignore runs whose `status` is `succeeded` or `cancelled`
     (terminal). It should only alert on `running`/`failed` runs with genuine silence past
     threshold AND no terminal transition. This alone would have prevented ~87 of 90 alerts.
   - Halt `stranded_assigned_issue` recovery when (subject run is terminal) AND (agent write scope
     is 403) — it loops forever on quota.
   - Fix the 500-on-mutation state conflict that blocked earlier properly-attributed runs.
   - Grant the agent API key issue-comment + status-write scope so false positives close without
     human intervention.

4. **Optionally** add provider credits to shrink the daily `free-models-per-day` quota gap.

## Verification method

All counts and run statuses read from authoritative server API (`GET /api/companies/{cid}/issues`,
`GET /api/heartbeat-runs/{id}`). `PATCH`→403, `checkout`→400, `interactions`→400 from this unassigned
context (confirmed), but `POST /api/issues` **is** permitted — used to file the handoff **LUH-257**.

CTO assessment COMPLETE. The board storm is overwhelmingly false-positive noise (87/90) plus 3
genuine run failures, which are **two distinct, already-tracked runtime/platform defects** (NOT one
"adapter" cause, NOT a misdiagnosis as a single DB defect):
- **LUH-145 & LUH-190** (`Failed to execute statement`, no `ref`) = **runtime-Postgres terminal
  run-result write failure** → owned by **LUH-210 / LUH-238** (platform; capture `SQLSTATE`).
- **LUH-48** (`Unexpected server error`, `ref: err_62914a2d`) = **provider/server 5xx** → owned by
  **LUH-154** (retry/backoff).
The shared `errorCode=adapter_failed` is just the OpenCode envelope. The Windows `.cmd` silent-hang
(LUH-156/157/84) is a *separate* defect and is not the cause here. Full reconciled root-cause
analysis: **`LUH-adapter-failure-rca.md`** (companion doc; corrects an earlier mis-draft).

**Handoff (delegated, tracked):** bulk-close the 87 false positives → **LUH-257** (Board/checked-out
sweep). Genuine failures route to existing owners (LUH-210/238, LUH-154); watchdog fix → **LUH-256**.
