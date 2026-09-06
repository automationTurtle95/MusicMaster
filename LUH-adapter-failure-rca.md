# RCA — Genuine Failures in the LUH Board Storm (RECONCILED with LUH-210)

**Author:** Odin (CTO agent `12190e84-...`) · **Date:** 2026-08-30 · **Run:** a2904fba (unassigned heartbeat)
**Companion docs:** `LUH-boardstorm-assessment.md` (storm scope, 105/90) · `docs/LUH-210-DB-RCA.md` (established Postgres-write RCA) · `docs/SILENT-RUN-CLUSTER-SYNTHESIS.md`
**Evidence basis:** authoritative server API run records (`GET /api/heartbeat-runs/{id}`) + established LUH-210/154/156 RCA docs + `AGENTS.md`.

---

## 0. Correction notice (read first)

An earlier draft of this RCA claimed the `adapter_failed` failures were "not a DB defect" and linked
all three to the Windows command-execution silent-hang (LUH-156/157). On reconciliation with the
**established `docs/LUH-210-DB-RCA.md`** (Odin, 2026-08-28) and the **LUH-48 run log**, those claims
are **withdrawn**:

- `Failed to execute statement` is, per LUH-210, a **runtime-Postgres terminal run-result write
  failure**, discriminated by *message + absent `ref`*. The `errorCode=adapter_failed` is merely the
  OpenCode adapter's envelope around that inner cause — not a separate "adapter" defect.
- **LUH-48** carries `ref: err_62914a2d` → it is the **provider/server 5xx** class (LUH-154), a
  *different* defect from LUH-145/190.
- The Windows `.cmd` silent-hang (LUH-156/157/84) is a **third, separate** silent-run defect and is
  **not** the cause of these three runs.

This RCA now aligns with, and defers to, the prior established analyses rather than overriding them.

---

## 1. The 3 genuine failures, discriminated (evidence from run records)

| Issue | Run | Agent | `error` | `ref` | `errorCode` | Class (per LUH-210 §2) |
|-------|-----|-------|---------|------|-------------|------------------------|
| LUH-145 | `bcddf199-3275-4d7b-bcfc-34d57a8ae523` | Odin (prior run) | `Failed to execute statement` | *(none)* | `adapter_failed` | **LUH-210** runtime-Postgres write |
| LUH-190 | `0c0db503-9c72-4eb8-9aac-54b83032b385` | Lukas (`438b1c89`) | `Failed to execute statement` | *(none)* | `adapter_failed` | **LUH-210** runtime-Postgres write |
| LUH-48  | `37989026-9f35-4e98-b54c-c7c781f74b6e` | `15571727...` | `Unexpected server error. Check server logs for details.` | `err_62914a2d` | `adapter_failed` | **LUH-154** provider/server 5xx |

**Discriminator (LUH-210 §2):** classify by *message + presence/absence of `ref`*.
- No-`ref` `Failed to execute statement` → runtime Postgres result-write failure (LUH-210).
- `Unexpected server error` + `ref: err_*` → provider 5xx wrapper (LUH-154).
- The shared `adapter_failed` is the **adapter-level envelope only**, not a distinct root cause.

---

## 2. LUH-145 / LUH-190 — runtime-Postgres terminal write failure (LUH-210 class)

Per the established `docs/LUH-210-DB-RCA.md`:
- The run does real work (`step_start` → tool calls → `step_finish`) **then dies at the terminal
  result/status persistence write** → the connection was alive & authenticated (rules out connection
  failure / token expiry).
- The failing statement is **runtime-Postgres** (the agent-runner uses Postgres; the MusicMaster app
  in this workspace uses SQLite, so it is *not* the app DB).
- Ranked hypotheses (H1–H5): constraint violation on the result write (duplicate run id on resume,
  JSON column limit, null in non-null column), serialization/deadlock (`40001`/`40P01`), migration
  drift, oversized payload (TOAST/column limit), or txn timeout.
- **Fix is platform/harness-owned:** the runtime source is **not checked out into any agent
  workspace** (confirmed by LUH-210 §3.4 and re-confirmed this run — the server runs from the npx
  cache `_npx/43414d9b.../paperclipai`, not a writable repo). Required evidence: the Postgres server
  log with `log_min_error_statement = ERROR` around the fault time to capture the actual SQL +
  `SQLSTATE`. That disambiguates H1–H5.
- **This run's own check does NOT refute LUH-210:** reads serve fine across the board (no
  `ECONNREFUSED`, no token-driven connection failure). That is fully consistent with LUH-210's
  "already-open connection, terminal write fails" thesis. The healthy-DB-for-reads observation must
  not be misread as "no DB defect."
- App-layer hardening already merged in this workspace (`prisma $extends` logs every failing
  statement with `code`/`message`/`meta`) applies to the **MusicMaster SQLite app**, not the runtime
  Postgres — it does not fix LUH-210. The platform should mirror it: emit the Postgres `SQLSTATE` on
  the run-result write instead of a generic `UnknownError`.

## 3. LUH-48 — provider/server 5xx (LUH-154 class)

- `ref: err_62914a2d` is present → an OpenAI/provider 5xx wrapper (LUH-210 §2, LUH-154).
- The agent's own bash typo in that run (`Head : ... nicht erkannt` — `CommandNotFoundException`) is
  **incidental**, not the failure cause; the run ended on the server-error envelope.
- Fix: platform retry/backoff on provider 5xx (owned by LUH-154).

## 4. NOT the Windows `.cmd` silent-hang

`AGENTS.md` ties LUH-156/157 to Windows `npm`/`node` `.cmd`-shim direct-spawn →
`%1 ist keine zulässige Win32-Anwendung` → silent hang after `step_start`. That is a **separate**
silent-run class (LUH-84 "zero-output silent hang", LUH-156/157). None of LUH-145/190/48 exhibit the
cmd-shim symptom — their logs show normal `step_start`/`tool_use` followed by an error envelope.
**Do not route these three to LUH-156/157 as the cause.** LUH-156/157 remain valid for the distinct
command-execution hardening, independent of this storm.

---

## 5. CTO decision — robust, targeted solution (no unnecessary rebuild)

Principle (AGENTS.md): *changes small, targeted, no invented facts; defer to established analysis.*

1. **87 false positives** → bulk-close as `done`/`false_positive`: Board/UI multi-select, or a
   properly-checked-out sweep run (PATCH 200 proven in run `98e616ad`). Stops the
   `stranded_assigned_issue` recovery loops burning the daily `free-models-per-day` quota.
2. **LUH-145 / LUH-190** → link as symptom issues under **LUH-210 / LUH-238** (platform-owned
   runtime-Postgres result-write fix; capture `SQLSTATE`). **Do NOT open a new "DB error" issue** —
   LUH-210 already owns it.
3. **LUH-48** → link under **LUH-154** (provider 5xx retry/backoff).
4. **Watchdog fix (LUH-256):** `stale_active_run_evaluation` must ignore runs already in a terminal
   state (`succeeded`/`cancelled`/`failed`) and alert only on `running` runs with genuine post-threshold
   silence. This alone prevents ~87 of 90 alerts.
5. **(Optional, platform)** Make the adapter emit structured `SQLSTATE`/provider code instead of a
   generic `adapter_failed`/`UnknownError` so future triage is unambiguous (reinforces LUH-210 §6).

---

## 6. Open items / handoff (this run is UNASSIGNED → writes blocked)

From this unassigned run, mutating writes are blocked (`PATCH`→403, `checkout`→400,
`interactions`→400, proven across runs c1500919/cfb4f1d9/b93d18f6/a2904fba). Therefore:

- ✅ **Delivered here:** this reconciled RCA + corrected `LUH-boardstorm-assessment.md` (durable
  workspace docs). No control-plane write attempted this heartbeat (prior 403/400 evidence already
  exceeds the 2-failure retry limit; the adapter/runtime status channel is the sanctioned fallback).
- ⛔ **Requires Board / human or a checked-out sweep run:**
  1. Bulk-close the 87 false-positive stale-run alerts → tracked as **LUH-257**.
  2. Re-link LUH-145/190 under LUH-210/238 and LUH-48 under LUH-154 (do not create duplicate DB issues).
  3. Drive the watchdog terminal-state filter (LUH-256).
  4. (Platform) Capture Postgres `SQLSTATE` for the LUH-210 result-write failure.
