# CTO-Finding: Agent-Control-Plane-Writes blockiert (Token/Run-Kontext-Mismatch)

**Datum:** 2026-08-26 · **Verantwortlich:** CTO-Agent (Odin) · **Schweregrad:** hoch (agentenübergreifend)

## Symptom

Alle schreibenden Control-Plane-Operationen des Agenten (Issue-Status `PATCH`,
Kommentare, Interactions, Issue-Erstellung) schlagen fehl mit HTTP 422/403,
obwohl der Agent-Token grundsätzlich gültig ist (Lesezugriffe wie
`GET /api/issues/{id}` funktionieren mit 200).

## Beweise (repräsentative Versuche)

| Header `X-Paperclip-Run-Id` | Token-Claim `run_id` | Server-Fehler |
|---|---|---|
| `194ed7f3-0a5a-40e2-895d-6ae477550e09` (=$PAPERCLIP_RUN_ID) | `d3fb2389-b57c-4870-9386-440edb09994c` | `agent_jwt_run_id_mismatch` (claim≠header) |
| `d3fb2389-b57c-4870-9386-440edb09994c` (=Claim) | `d3fb2389-…` | `cross_issue_influence_run_context_required` ("without a valid run") |

Run-Status (via `GET /api/heartbeat-runs/{id}`):
- `194ed7f3-…` → **succeeded**, finishedAt 2026-08-26T00:30:18Z
- `d3fb2389-…` → **running**, startedAt 2026-08-26T00:54:02Z

## Root Cause

Der Agent-API-Key (`PAPERCLIP_API_KEY`) trägt im JWT einen `run_id`-Claim, der
auf einen **anderen** Run zeigt als die Laufzeit-Variable `$PAPERCLIP_RUN_ID`.
Die Server-Validierung verlangt für Cross-Issue-Writes, dass

1. der Header `X-Paperclip-Run-Id` exakt dem Token-Claim entspricht **und**
2. dieser Run ein gültiger (aktiver) Heartbeat-Run ist.

Beide Bedingungen sind simultan nicht erfüllbar, weil Env-Run und Token-Claim
auseinanderlaufen (vermutlich ein Relikt aus Auto-Recovery / mehrfachen
Run-Spawns): das Env zeigt auf einen bereits beendeten Run, das Token auf einen
anderen, zwar laufenden, aber nicht als Ausführungskontext registrierten Run.

## Auswirkung

- Der CTO-Agent kann Issue-Status nicht setzen, keine Kommentare/Interactions
  schreiben, keine Child-Issues anlegen.
- Dies erklärt wahrscheinlich die wiederkehrenden, teils `blocked` stehenden
  "Review silent active run for Odin"-Monitoring-Issues: Runs agieren mit
  inkonsistentem Run-Kontext, Control-Plane-Writes schlagen still fehl.

## Empfohlene Behebung (Unblock-Owner: Paperclip-Runtime / Infra bzw. Board)

1. **Token-Neuausstellung:** Dem Agenten einen API-Key ausstellen, dessen
   `run_id`-Claim mit dem aktiven `$PAPERCLIP_RUN_ID` übereinstimmt (oder den
   Claim entfernen/auf den ausführenden Run binden).
2. **Env-Konsistenz:** Sicherstellen, dass `$PAPERCLIP_RUN_ID` auf den Run
   zeigt, dessen `executionRunId`/`checkoutRunId` der Agent ist.
3. **Auto-Recovery-Härtung:** Bei Wiederanlauf eines Agenten Token+Run-Kontext
   gemeinsam erneuern, nicht unabhängig voneinander.

## Workaround (für sofortige Issue-Dispositionen)

Bis zur Token-Korrektur müssen Issue-Status-Änderungen durch einen berechtigten
Board/User-Token (oder die UI) vorgenommen werden. Der inhaltliche Stand ist
in `docs/SECURITY-REVIEW-LUH-15.md §11` dauerhaft hinterlegt (LUH-15 erfüllt
alle Akzeptanzkriterien, schließbar sobald der Write-Path wieder frei ist).

## Korrektur (2026-08-26, Odin) — Token war kein echter Blocker

Der obige Token/Run-Mismatch war ein **transientes Auto-Recovery-Artefakt**:
im nachfolgenden Run war der Token konsistent (`run_id`-Claim == `$PAPERCLIP_RUN_ID`),
und Cross-Issue-Writes funktionierten wieder. Die *tatsächliche* Ursache, warum
LUH-15 nicht schloss, war keine Berechtigung, sondern **Tracker-Drift**
(kaskadierende `blocked`-Zustände, weil Parent-Issues nie geschlossen wurden,
obwohl die Arbeit via Child-Issues erledigt war). Details + Reconciliation in
`docs/SECURITY-REVIEW-LUH-15.md §13`. Dieses Dokument dient nur noch als
Historie zum damaligen Symptom.

---

## Aktualisierung (2026-08-27, Odin — Run `8aa50b50-11aa-4be0-9338-d2422bfdb0e5`)

Die obige "Korrektur" (Token sei konsistent/fein) war selbst ein Artefakt eines
kurzlebigen Runs. Im aktuellen Run ist der Token zwar konsistent
(`run_id`-Claim == `$PAPERCLIP_RUN_ID` == `8aa50b50-…`), aber **abgelaufen** –

### Beweise (dieser Run)
- JWT-Decode des `PAPERCLIP_API_KEY`: `iat = 1787759644` (2026-08-26T15:54:04Z),
  `exp = 1787763244` (2026-08-26T16:54:04Z) → **1h-TTL**, jetzt ~10h überschritten.
- `GET /api/companies/{id}/issues` mit diesem Token → **401 Unauthorized**
  (`{"error":"Unauthorized"}`). Ein falscher Pfad gäbe 404, also echte
  Token-Ablehnung, kein Routing-Zufall.
- `run_id`-Claim stimmt mit `$PAPERCLIP_RUN_ID` überein → der alte
  "run_id-Mismatch"-Verdacht trifft hier **nicht** zu.

### Geschärfte Root Cause
Der Agent-API-Key hat eine **1-Stunden-TTL ohne Refresh**. Jeder Run, der länger
als 1h lebt (oder nach >1h "resumed"/fortgesetzt wird), verliert still die
Control-Plane-Berechtigung. Das erklärt kaskadierend, warum LUH-168/174/177/179/208
trotz fertiger Arbeit nicht vom Agenten geschlossen werden konnten – nicht wegen
eines Run-Mismatch, sondern wegen **Token-Ablauf**.

### Unblock-Owner (Plattform/Infra oder Board)
1. Token auf jedem Heartbeat/Resume neu ausstellen (Refresh), oder
2. für long-lived Runs deutlich längere TTL (oder `exp` nach hinten verschiebbar),
   oder
3. Loopback/localhost als vertrauenswürdig behandeln (der lokale Adapter läuft
   ohnehin auf demselben Host).

Bis dahin: Issue-Status/Kommentare müssen über einen frischen Board-/User-Token
oder die UI gesetzt werden. Inhaltliche Dispositionen bleiben lokal hinterlegt.

### CTO-Produkt-Audit (MusicMaster, derselbe Run)
Kurzer Security-/Architektur-Durchlauf des vorliegenden MusicMaster-Codes
(`tsc --noEmit` läuft **sauber** durch):

- **Auth-Layer solide:** NextAuth v5, Credentials + `scrypt`/`timingSafeEqual`
  (`lib/password.ts`), JWT-Role-Propagation, Runtime-Fail-Fast bei fehlendem
  `AUTH_SECRET` (verhindert Redirect-Loop). Middleware + jede Mutation-Route
  prüfen `auth()` und (für Schreiben) `isManager()`.
- **File-Upload gehärtet:** `upload` validiert Größe (20 MB), deklarierten
  MIME-Typ **und** PDF-Magic-Bytes; `lib/storage.ts` schützt per Regex gegen
  Path-Traversal; PDF-Serve-Route ist auth-pflichtig.
- **Kein Blocker**, aber CTO-Standards als Folge-Workloads:
  1. Rate-Limiter ist In-Memory/Single-Instance (`lib/rate-limit.ts`) → bei
     Horizontal-Scaling durch verteilten Store (Redis) ersetzen.
  2. Resend-Provider + `PrismaAdapter` + JWT-Strategie ist eine latente
     NextAuth-v5-Kombo (derzeit inaktiv ohne `RESEND_API_KEY`) → vor Aktivierung
     explizit testen.
  3. Audit-Log für privilegierte PII-Operationen (Mitglied/Noten anlegen/löschen)
     erwägen.
- Details/Abnahme siehe `docs/SECURITY-REVIEW-LUH-15.md`.
