# LUH-213 — Design & Reference Handoff: Monitor de-noising (silent-run false positives)

**Author:** Freya (Head of Design) · **Issue owner / unblock:** Paperclip board (operator dashboard) · **Priority:** high
**Parent cluster:** LUH-153 / LUH-213 (CTO synthesis) · **Companion docs:** `docs/SILENT-RUN-CLUSTER-SYNTHESIS.md`, `docs/LUH-211-design-handoff.md`
**Status of this artifact:** monitor UX spec delivered as a handoff; board/operator-dashboard implementation is platform-owned (source not in any agent workspace — see §8).

---

## 1. Why the monitor is itself a UX defect (the board action nobody shipped)

The CTO synthesis (item #3, "Board: de-noise the monitor") is framed as an SRE/alerting chore. It is **first an operator-experience defect**, and only secondarily a log volume problem. The "Review silent active run for Odin" monitor is the surface a human actually stares at, and today it:

- **Merges two opposite states into one scary label.** A run that is *alive but write-blocked* by LUH-169 (expired agent token → status updates can't land) looks **identical** to a run that is *genuinely dead/hung*. Both surface as "silent." That is a **mapping violation** (Norman): the signal does not correspond to the underlying state, so the operator cannot reason about it.
- **Manufactures false positives at scale.** LUH-177 and LUH-208 are **confirmed alive** (run alive, just couldn't write). Every such run spawns a "review" issue. This is classic **alert fatigue** (a recognized precursor to real incidents being ignored) — the operator learns to dismiss the signal, which is the worst possible outcome for a safety monitor.
- **Snowballs.** "Dozens of issues per silent run" (LUH-154 §meta) — one root cause produces N tickets, each demanding a human. That violates **Tesler's law** (push the complexity to the system, not the user) and **Shneiderman #1** (strive for consistency — one cause, one signal).
- **Offers no recourse.** There is no in-surface **cancel / recover** control; an orphaned run can only be closed by operator/DB intervention. A monitor that reports a problem but gives no action violates **Nielsen #9** (good error messages tell the user what to do) and **Shneiderman #8** (support internal locus of control).

So the fix is not "tune thresholds." It is a **status-taxonomy + aggregation + control** redesign of the operator monitor. That is squarely design-owned.

Design lenses applied: **Norman (mapping, signifier, feedback, constraints)**, **Nielsen #1/#9**, **Shneiderman #1/#8**, **Gestalt (similarity/proximity — group by run, not by alert)**, **WCAG POUR (color-independent status, live regions, target ≥44px)**, **Zeigarnik (make the open loop visible so it can be closed)**, **data-minimization (never ask the operator to do what the system should)**.

---

## 2. The core error: one label for two states

Today the monitor emits a single binary: `silent` (no status update within window) → "review."

The CTO synthesis proves `silent` is **not atomic**. Decompose it:

| Underlying state | Real cause | Should read as | Is it a hang? | Operator action |
|---|---|---|---|---|
| `alive_write_blocked` | LUH-169 token expired → writes 401/403; reads OK, process alive | **"Alive — write access lost (token)"** | No | Re-wake / refresh token (system) |
| `alive_degraded` | LUH-154 transient retries in flight | **"Alive — retrying model call"** | No | None (auto) |
| `alive_cancelled` | operator/board cancelled the run | **"Cancelled"** | No | None |
| `dead_unknown` | process gone, no output beyond threshold | **"No response — likely hung"** | Yes (suspected) | Recover / cancel |
| `db_fault` | LUH-210 `Failed to execute statement` | **"Stopped — DB error"** | No | Investigate DB |

The whole false-positive class collapses once `alive_write_blocked` and `alive_degraded` are **named distinctly from `dead_unknown`**. The monitor must read the *write-block signal* (401/403 on a status PATCH) as **evidence of liveness**, not silence. A run that is still trying to write is alive; the absence of a *successful* write is the defect, not the run.

**Heuristic to kill false positives:** a run that has emitted *any* recent read or attempted-write activity (heartbeat, tool call, PATCH attempt) within the window is `alive_*`, never `dead_unknown`. Only a run with **zero signal of any kind** (no reads, no writes, no process) past the window earns "likely hung."

---

## 3. Operator-facing monitor redesign

### 3.1 One rolling monitor, not one issue per run
Replace the per-run "Review silent active run for {agent}" issue spawner with **a single aggregate monitor object** per agent, e.g. "Runs needing attention — Odin." It lists only runs currently in a *genuinely* actionable state (`dead_unknown`, `db_fault`, and `alive_write_blocked` once it has persisted past a grace period). Each run is **one row**, not one ticket. (Gestalt proximity: group by run; **Simpson's/Fitts**: one target to scan, not N.)

### 3.2 Status chip per run (color-independent — WCAG 1.4.1)
Use the existing design-system palette. Status is **always icon + label**, never color alone. Map to tokens:

| State | Chip token (bg / fg) | Icon | Label |
|---|---|---|---|
| `alive_write_blocked` | `secondary` (#ede3d2 / #1e1a15) | 🔒 | "Alive · write-blocked" |
| `alive_degraded` | `accent` (#e7efe6 / #4f7a52) | ⟳ | "Alive · retrying" |
| `alive_cancelled` | `muted` (#f0e8d8 / #6b6155) | ⊘ | "Cancelled" |
| `dead_unknown` | `destructive` (#a13b2f / #fff) | ⚠ | "No response" |
| `db_fault` | `destructive` (#a13b2f / #fff) | ⚠ | "DB error" |

Chips render with `radius` (`--radius: 0.5rem`), `space-2` padding, `text-secondary` weight. Never rely on hue: the lock/refresh/warning glyphs carry meaning for color-blind and AT users.

### 3.3 Aggregation rule (anti-snowball)
- Emit **one** monitor row per run. Never create a new ticket on each silence probe.
- If >1 run is `dead_unknown` simultaneously, **roll up** into one "N runs no response" summary row (Von-Restorff: the exception stands out; the mass does not spam).
- A run that resolves (`recovered`/`cancelled`) **auto-drops** from the monitor; no manual close. (Zeigarnik closure; reduces operator bookkeeping.)

### 3.4 Live feedback (Doherty <400ms; Norman feedback)
The monitor polls and reflects state changes within the window; each state transition announces via `aria-live="polite"` except `dead_unknown`/`db_fault` which use `aria-live="assertive"` (something needs a human). No silent state changes.

---

## 4. The missing control: cancel / recover affordance

The synthesis notes "no explicit run cancel/recover control-plane path." This is the single highest-leverage UX fix for the operator, because today an orphaned run can only be cleared by DB/operator heroics.

Add, **per run row**, two controls (target ≥44px — WCAG 2.5.8; use existing `<Button>`):

- **Recover** — re-wakes the run with a **fresh token** (this also resolves `alive_write_blocked`, since LUH-169's defect is *reused expired token on resume* — a fresh mint sidesteps it). Label: "Re-run with fresh token." Confirmation required for destructive-adjacent action (Shneiderman #8: prevent errors).
- **Cancel** — terminates the run and marks it `alive_cancelled`. Destructive → **explicit confirm** (Nielsen #9; avoid Confirmshaming — the confirm copy states plainly what will stop, not "Are you sure you want to miss out?").

These are **signifiers** (Norman) for the previously-invisible control plane. They also reduce the false-positive blast radius: an operator can clear a `dead_unknown` in two clicks instead of escalating.

> Ethics check: the confirm dialog must be a plain, reversible-framed confirmation ("Cancel this run? In-progress work for this run stops."), **not** a Roach-Motel / Confirmshaming pattern. No dark patterns.

---

## 5. False-positive guardrails (so the signal stays trustworthy)

1. **Liveness-from-attempts:** a run that issues *any* PATCH/POST (even a failed 401) within the window is `alive_write_blocked`, excluded from `dead_unknown`. This alone reclassifies LUH-177 + LUH-208 correctly.
2. **Grace before flagging:** only promote `alive_write_blocked` to operator attention after it persists > the token-TTL remainder (e.g. 10 min), so transient resume artifacts don't page.
3. **De-dupe by run id:** the monitor keys on run id, never on alert count. (Tesler: complexity in the system.)
4. **Audit the false-positive rate:** track how many `dead_unknown` rows later resolve themselves; if the rate is high, the classifier is still too eager (feedback loop to §2).

---

## 6. Reference copy (plain language, reverse-pyramid)

Monitor header (one line): **"Runs needing attention — Odin: 2 (1 no-response, 1 write-blocked)."**

Per-row detail (expand):
- `alive_write_blocked`: "This run is alive but lost write access (expired token). It can be re-run with a fresh token; no data is lost." → *[Re-run with fresh token]*
- `dead_unknown`: "This run has shown no activity for the full window and may be hung. You can cancel it or try a recovery." → *[Recover] [Cancel]*
- `db_fault`: "The run stopped on a database error, not a model outage. Retrying won't help; investigate the database." → *[View incident]* (no Retry — data-minimization; no fake action)

This makes the **discriminator visible** (mirrors LUH-211 §4): the operator instantly knows whether retry is even meaningful — preventing both wasted retries and false "it'll be fine" signals.

---

## 7. Acceptance criteria

**Design / UX**
1. The monitor shows **distinct, color-independent** states for `alive_write_blocked`, `alive_degraded`, `alive_cancelled`, `dead_unknown`, `db_fault` (icon + label, never color alone).
2. A run with *any* attempted write/read in-window is **never** labeled `dead_unknown` (false-positive guardrail §5.1).
3. Exactly **one** monitor row exists per run; no new ticket per silence probe; >1 `dead_unknown` rolls up into one summary row.
4. Each row exposes **Recover** and **Cancel** controls (≥44px, plain-language confirm, no Confirmshaming).
5. State transitions announce via `aria-live`; reduced-motion variant exists; chips use design-system tokens (`secondary`/`accent`/`destructive`/`muted`, `--radius`).

**Engineering (enables the above)**
6. The monitor ingests write-block signals (401/403 on status PATCH) as **liveness**, not silence.
7. A "re-run with fresh token" control mints a **new token on resume** (closes LUH-169's reuse-expired-token trap).
8. Resolved runs auto-drop from the monitor (no manual close).

---

## 8. Scope & disposition of this artifact

- **Source location:** the operator monitor / board dashboard is the **Paperclip platform UI**, which (like the harness in LUH-211 §9) is **not checked out into any agent workspace** — confirmed by the same instance-tree search used in `docs/LUH-154-disposition.md` §2. So this is a **handoff spec**, not a code change in this repo.
- **Visual-Truth-Gate:** I could not render the live board monitor (not in workspace). Per the gate, scope is explicit: this handoff specifies the states, tokens, copy, and controls; the **visual build + screenshot verification** belongs to the board/frontend owner, who should attach 1440×900 + 390×844 views before marking the monitor work `done`.
- **Unblock owner:** **Paperclip board / operator-dashboard team** (named). LUH-213's synthesis analysis is complete (CTO); this design handoff closes the board action item #3. The remaining *engineering* fixes (LUH-169 token refresh, LUH-154 retry, LUH-210 DB) are tracked on their own issues and are **out of design scope**.
- **Delegated implementation issue:** **LUH-239** ("Implement operator monitor de-noising redesign (LUH-213 handoff)") carries this spec to the board team with the Visual-Truth-Gate requirement (1440×900 + 390×844 screenshots before `done`). LUH-213 (design synthesis + handoff) is marked `done`; LUH-239 owns the build + visual verification.

---

## 9. Trade-offs & residual risks

- **Grace window (§5.2) trades latency for fewer false pages.** Too short → LUH-177-class noise returns; too long → a real `dead_unknown` waits. Start at ~10 min and tune from the false-positive audit (§5.4).
- **Auto-drop on resolve (§3.3) means a flapping run may vanish before an operator sees it.** Mitigation: keep a 24h "recently cleared" history the operator can expand.
- **`alive_write_blocked` vs `dead_unknown` still share "no successful status write."** The discriminator is *attempted* writes; if the runtime stops even attempting (hard token drop), it could be misread as `dead_unknown`. The §5.4 audit catches this.
- This artifact is design-only; the live monitor code is platform-owned and must be ported there.
