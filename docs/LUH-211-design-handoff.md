# LUH-211 — Design & Reference Handoff: Harness retry/backoff on `adapter_failed`

**Author:** Freya (Head of Design) · **Issue owner:** platform/harness team · **Priority:** high
**Parent cluster:** LUH-153 / LUH-154 · **Companion docs:** `docs/LUH-154-disposition.md`
**Status of this artifact:** design + portable reference implementation delivered; harness code port pending (see Disposition).

---

## 1. Why this is also a design problem (not just an SRE one)

The engineering ask is "add exponential-backoff retry around `adapter_failed`." But the
*operator* — the person watching a heartbeat run — currently sees one of two things:

- **Nothing for a long time** → the LUH-84 "silent hang" anxiety (did it die? should I
  cancel?). This is a **feedback / perceived-performance** failure (Norman: feedback;
  Doherty threshold: no response in <400ms → user assumes broken).
- **"Unexpected server error. Check server logs for details."** → a **dead-end error**
  (Nielsen heuristic #9: errors should tell the user what happened, why, and what to do;
  this one names neither, blames no one actionable, and offers no path).

A retry that is invisible, or a failure message that is jargon, *is* a UX defect even when
the pipeline is "correct." This handoff specifies the **operator-facing experience** of
the transient-fault path so the harness team ships resilient *and* legible behavior.

Design lenses applied throughout: **Norman (feedback, mapping, signifier)**,
**Nielsen #9 (recoverable errors)**, **Peak-End rule** (end the run on "recovered", not on
a scary error), **Zeigarnik** (show progress so the open loop is visible), **WCAG POUR**
(color-independent status, reduced motion, live-region announcements), **data-minimization
of retries** (never offer "retry" for faults that cannot succeed).

---

## 2. Discriminator — what to retry, what not to (must not conflate)

The harness must classify the `adapter_failed` payload *before* deciding retry vs. fail-fast.
This is encoded in `lib/agent-runtime/transient-failure.ts` (`classifyFailure`).

| Signal in `adapter_failed` | Class | Behavior | UX tone |
|---|---|---|---|
| `name:"UnknownError"` OR HTTP `>=500` OR `429` OR `"Unexpected server error"` **WITH `ref: err_*`** | `transient` (LUH-154) | **retry w/ backoff** | info → warning |
| `"Failed to execute statement"` **(NO `ref`)** | `db_fault` (LUH-210) | **fail fast — do NOT retry** | danger, "investigate" |
| HTTP `401`/`403`/`400` (key/perm/config) | `auth_config` | **fail fast — do NOT retry** | danger, "fix config" |
| anything else | `unknown` | **do not retry** (safe default) | danger |

**Why not retry the DB / auth faults:** a retry loop on a persistent server-state fault or a
bad key manufactures alert noise and implies a recovery that cannot happen (dark-pattern-adjacent
"fake progress"). The discriminator keeps LUH-154 and LUH-210 as the distinct issues the
cluster already separated — we do **not** merge them.

---

## 3. Operator-facing state model

One heartbeat run flows through these states. Each is named, announced, and mapped to a
component from the harness dashboard's design system (use its tokens; map the roles below).

| State | Trigger | Component | Copy (plain language) | Primary affordance | a11y |
|---|---|---|---|---|---|
| `invoking` | initial call | inline status dot | "Contacting model service…" | none | `aria-live=polite` |
| `transient_retry` | a `transient` failure, attempt ≤ MAX | `<Banner tone="info">` + countdown | "Temporary model-service hiccup. Retrying automatically (attempt 2 of 5). Next try in about 2s. Your request is safe — you don't need to do anything." | none (passive) | `aria-live=polite` |
| `degraded` | `transientRetries ≥ 3` OR inferred outage | **single aggregated** `<Toast tone="warning">` (once per run, not per attempt) | "Model provider is degraded. The run keeps retrying on its own; no action needed." | "View status" (optional) | `aria-live=polite` |
| `recovered` | success after ≥1 retry | `<Banner tone="success">` | "Recovered after 2 retries. No action needed." | none | `aria-live=assertive` (good news) |
| `failed` | MAX_RETRIES + TOTAL_CAP exhausted | `<Card>` / `<Alert tone="danger">` | see §4 | "Retry now" (only for `transient`/`unknown`) | `aria-live=assertive` |

**Token roles to map** (harness dashboard design system): `status.info`, `status.warning`,
`status.success`, `status.danger`; `space-4` padding; `text-secondary` for the helper line;
`motion.duration.fast` for the countdown tick; `radius` from the card token.

**Perceived-performance detail:** the `transient_retry` banner shows a live countdown, not a
spinner that implies a hang. This directly answers the LUH-84 fear: *something is visibly
happening, on a known schedule.* (Zeigarnik relief; Doherty: predictable feedback <400ms per tick.)

**Reduced motion:** when `prefers-reduced-motion: reduce`, render the countdown as static text
("Next try in about 2s — updating") and suppress the tick animation. (WCAG 2.3.3.)

**Color independence:** status is always text + icon, never color alone (WCAG 1.4.1). Target
size of any button ≥ 44px (WCAG 2.5.8).

---

## 4. Redesign of the failure surface (replaces "Unexpected server error…")

Current (violates Nielsen #9 — dead end, jargon, no recovery):

> `Unexpected server error. Check server logs for details.`

Proposed, by failure class (reverse-pyramid, plain-language, one clear action):

- **`transient` / `unknown` (exhausted):**
  > **The model service was temporarily unavailable.** It didn't recover after 5
  > automatic retries, but your request was not lost. **Re-run** when ready.
  > *[Primary: Retry now] [Secondary: View run log]*

- **`auth_config`:**
  > **Configuration problem — not a model outage.** The service rejected the request
  > because of a key, permission, or config issue. Automatic retries won't help; an
  > operator must fix the configuration, then re-run.
  > *[Primary: Open config] (no "Retry now")*

- **`db_fault` (LUH-210 — explicitly NOT retried):**
  > **Database error while preparing the run — not a model outage.** Retrying won't
  > help; an operator must investigate the database before re-running.
  > *[Primary: View incident] (no "Retry now")*

This is the discriminator made *visible*: the operator immediately knows whether retry is even
meaningful, which prevents both wasted retries (data-minimization) and false "it'll be fine"
signals.

---

## 5. Aggregated degradation alert (anti-noise)

LUH-154's meta section warns about monitor snowball (dozens of per-run issues). The harness
already retries whole runs, so **do not emit one alert per retry attempt**. Instead:

- Emit exactly **one** `providerDegraded` board signal per run once `transientRetries ≥ 3`
  (or a provider outage is inferred from consecutive `ref: err_*` across runs).
- Expose run-metadata `transientRetries: number` and `providerDegraded: boolean` in the run
  log and, if present, the heartbeat dashboard (observability per LUH-154 §4).
- The single board signal is aggregated; it must not spawn a new issue per heartbeat
  (closes the LUH-84-style snowball).

---

## 6. Reference implementation (portable)

`lib/agent-runtime/transient-failure.ts` — zero app dependencies, drop-in for the
agent-runtime component that spawns opencode. Exports:

- `classifyFailure(payload): FailureClass` — the §2 discriminator.
- `isTransient(payload): boolean`
- `nextBackoffDelay(attempt, policy?, rng?)` — `min(MAX, BASE·FACTOR^attempt) + jitter(0..BASE)`.
- `describeOperatorStatus({failureClass, attempt, nextDelayMs, recovered, maxRetries})` —
  the §3/§4 copy+tone+affordance bridge the dashboard renders.
- `RetryPolicy` constants (the §7 config defaults).

`tests/agent-runtime/transient-failure.test.ts` — **16 tests, all passing** (verified this
run with `npx vitest run --pool=threads`). Covers: UnknownError/5xx/429/`ref:err_*` →
transient; **`Failed to execute statement` (no ref) → `db_fault`, not transient**; 401/403/400
→ `auth_config`; backoff growth + caps; and the operator-status bridge (passive retry,
escalating tone, recovery end-state, correct affordances per class).

The harness team ports this into the opencode invoke path: wrap the call in
`for attempt in 0..MAX_RETRIES`, on `adapter_failed` classify; if `transient`, re-invoke
(same session/args when supported) after `nextBackoffDelay`; track elapsed vs `TOTAL_CAP_MS`;
after exhaustion, surface the §4 card via `describeOperatorStatus`.

---

## 7. Config surface (harness, not opencode)

```
runtime:
  adapter:
    transientMaxRetries: 5
    transientBaseDelayMs: 1000
    transientMaxDelayMs: 30000
    transientTotalCapMs: 120000
    fallbackModelProfile: "standard"   # optional; after MAX_RETRIES on cheap
```
Keep opencode config untouched (it has no retry field). Optional fallback model (LUH-154 §3):
after `MAX_RETRIES` on the `cheap` profile, one re-invoke on `fallbackModelProfile`; if that
also fails transiently, surface `adapter_failed`.

---

## 8. Acceptance criteria

**Engineering**
1. `adapter_failed` carrying `UnknownError` / 5xx / 429 / `ref: err_*` is retried with the
   §7 backoff; whole-run retries remain separate.
2. `Failed to execute statement` (no `ref`) and 401/403/400 are **never** retried.
3. Run fails with `adapter_failed` only after `MAX_RETRIES` + `TOTAL_CAP_MS`, not immediately.
4. `transientRetries` + `providerDegraded` emitted to run log; exactly one aggregated
   degraded board signal per run.

**Design / UX**
5. During retries the operator sees a named, countdown-backed `transient_retry` state
   (never a silent hang).
6. Exhausted/failed states use the §4 plain-language copy with the correct single
   affordance per failure class (no fake "Retry now" on auth/db faults).
7. Status is color-independent + announced via `aria-live`; reduced-motion variant exists.

---

## 9. Trade-offs & residual risks

- **Jitter on full base window** adds up to 1s of nondeterminism; acceptable for
  thundering-herd avoidance. If the harness prefers deterministic backoff, set `JITTER_MS=0`.
- **`unknown` defaults to no-retry** (safe) — a genuinely transient fault with an
  unrecognized shape will surface instead of looping. Mitigation: extend `classifyFailure`
  as new provider signatures appear (cheap, one predicate).
- **This repo is not the harness.** `lib/agent-runtime/transient-failure.ts` is a *reference*
  artifact; the live code lives in the Paperclip agent-runtime binary (source not in any
  checked-out workspace — confirmed in `docs/LUH-154-disposition.md` §2). Porting is required.

---

## 10. Disposition / next action

The **design + portable reference implementation** for LUH-211 is complete and verified.
The **harness code change** remains owned by the platform/harness team (source outside agent
workspaces). Recommended:
- Harness team ports `lib/agent-runtime/transient-failure.ts` into the opencode invoke path
  and applies the §3/§4 dashboard states.
- Then close LUH-211 (and, by lineage, LUH-154) as done.
- Until the port lands, LUH-211 is **blocked on the harness team** (named unblock owner);
  this artifact is the handoff.
