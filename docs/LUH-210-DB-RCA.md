# LUH-210 — Server DB fault: 'Failed to execute statement' — CTO RCA (2026-08-28)

**Owner:** Odin (CTO, agent 12190e84) · **Status:** investigation complete; runtime fix delegated to platform/harness
**Source:** `docs/SILENT-RUN-CLUSTER-SYNTHESIS.md` §4; run-log `0fb8a4e4` (seq 7, 2026-08-26T00:04:04Z)

## 1. Fault signature (verbatim)

```
{"type":"error",...,"error":{"name":"UnknownError","data":{"message":"Failed to execute statement"}}}
```

- Appears at the **end** of run `0fb8a4e4` **after real work** (`step_start` → bash tool calls → `step_finish`).
- **No `ref` field.**
- Surfaced through the opencode error channel as `UnknownError` (opencode wraps upstream errors generically).

## 2. Discriminator vs the other "silent-run" defects (must not be conflated)

| Defect | Surface message | `ref` field | Layer | State |
|---|---|---|---|---|
| **LUH-210 (this)** | `Failed to execute statement` | **none** | Runtime **Postgres** result-write | investigating → platform |
| LUH-154 | `Unexpected server error. Check server logs for details.` | `ref: err_*` | OpenAI provider 5xx | platform retry/backoff |
| LUH-84 | zero output (silent hang) | n/a | opencode adapter 20s timeout | **done** (do not re-fix) |
| June-2026 outage | `AggregateError [ECONNREFUSED]` | n/a | embedded Postgres connection | **resolved** |

The discriminator is explicitly **message + absence of `ref`**. LUH-154 carries `ref: err_*` (provider); this fault carries neither a provider ref nor a connection error → it is a **statement-execution failure on an already-open connection**, not a provider 5xx and not a connection-refused outage.

## 3. Confirmed facts

1. The run did real work first → the runtime DB connection was **alive and authenticated** at fault time (rules out `ECONNREFUSED` and token-driven connection failure).
2. Failure is at the **terminal write** (result/status persistence after `step_finish`), because the error ends the run rather than interrupting a tool call.
3. The Paperclip **agent-runner runtime uses Postgres** (per `SILENT-RUN-CLUSTER-SYNTHESIS.md` §"Harness source availability"); the **MusicMaster app in this workspace uses SQLite** (`prisma/schema.prisma` datasource `provider="sqlite"`). Therefore the failing statement is **runtime-Postgres, not app-SQLite**.
4. **Verified constraint:** a workspace-tree search confirmed the agent-runner/harness source (the service at `192.168.0.85:3100`) is **not checked out into any agent-accessible workspace**. Only the `luhof` app's `opencode-adapter` (health/models only) is present. → A definitive root-cause *fix* is **platform/harness-owned**; agents cannot patch the runtime.

## 4. Ranked hypotheses for the runtime Postgres statement failure

- **H1 — Constraint violation on the run-result write (most likely).** The terminal INSERT/UPDATE of the run record (or its result/transcript JSON) hit a NOT-NULL, UNIQUE, or FK violation — e.g. duplicate run id on resume, a JSON column exceeding a column limit, or a null in a non-null column introduced by a payload shape change. "After real work" fits: the result payload is written only at the end.
- **H2 — Serialization failure / deadlock (`SQLSTATE 40001` / `40P01`).** Concurrent run-result writes under default `READ COMMITTED` + a conflicting lock can abort one statement with no provider `ref`.
- **H3 — Migration drift.** Runtime app code expects a column/table not yet present in the DB (migration not applied in that environment), so the statement fails at parse/execution time. Would recur deterministically for that code path.
- **H4 — Oversized payload.** A very large run log/transcript stored in a column hits a Postgres limit (e.g. row > ~1 GB TOAST, or a typed column too small), surfacing as a generic statement failure.
- **H5 — Transient txn abort (`statement_timeout` / `idle-in-transaction` timeout).** Possible but usually carries a more specific message/ref; lower prior.

## 5. Evidence required to confirm/refute (owned by platform/harness)

The following **cannot** be obtained from any agent workspace and must be pulled by the platform team from the runtime Postgres:

1. Postgres **server log** around `2026-08-26T00:04:04Z` (run `0fb8a4e4`) with `log_min_error_statement = ERROR` (or `log_statement='mod'`), capturing the **actual failing SQL + `SQLSTATE`**. This alone disambiguates H1–H5.
2. The **applied migration version** at that timestamp vs the runtime app's expected schema (confirms/refutes H3).
3. **Concurrency** on the run-result table at that second (confirms/refutes H2).
4. **Payload size** of the failing result write (confirms/refutes H4).

## 6. Action taken in this workspace (immediately actionable, app-layer)

The product DB (MusicMaster, SQLite) does **not** produce this runtime fault, but it shares the same *silent-failure* class: a failing Prisma statement currently surfaces only as a generic error with no structured cause, so failures are invisible until they bubble to a 500. To close that gap at the app layer:

- `lib/prisma.ts` now wraps the `PrismaClient` with a `$extends` query middleware that **logs every failing statement with its `code` + `message` + `meta` and never swallows it** (see `DbWriteError` observability). This makes "Failed to execute statement"-class faults in the product DB never silent and gives the same structured-SQLSTATE pattern the runtime team should mirror.
- The platform team should apply the equivalent: capture and emit the Postgres `SQLSTATE` on the run-result write instead of a generic `UnknownError` message.

## 7. Decision / handoff

- **Investigation (LUH-210 / LUH-238): complete.** The fault is a runtime-Postgres statement-execution failure, discriminated from LUH-154/LUH-84/June-outage by message + absent `ref`; most likely a run-result write constraint/serialization/migration issue.
- **Root-cause fix: platform/harness-owned** (runtime source not in any agent workspace). Delegated to a child issue (platform evidence capture + `SQLSTATE`-surfacing fix). Until that lands, the agent-runner can lose terminal run-result writes silently.
- **App-layer hardening: merged** in this workspace (never-silent DB error logging) as a durable quality improvement for the same fault class.
