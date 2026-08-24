# Security Review – LUH-15

**Stand:** 2026-08-24 · **Verantwortlich:** CTO-Agent (Odin)
**Umfang:** MusicMaster (Next.js 15 App Router, NextAuth v5, Prisma/SQLite, Tailwind v4)

Dieses Dokument ist die Grundlage für LUH-15 (Security review & hardening, OWASP Top 10,
Dependency-Audit, Secrets-Scan, CORS/CSP, Rate Limiting, Input-Sanitization).

## 1. Dependency Vulnerability Scan (`npm audit`, 2026-08-24)

Ergebnis: **8 Schwachstellen (2 kritisch, 3 hoch, 3 mittel)**.

| Paket | Schweregrad | Prod-/Dev-Dep | Betroffener Bereich | Maßnahme |
|-------|-------------|---------------|---------------------|----------|
| `next` (15.1.6 → **15.5.23**) | **kritisch** (restlich) | Prod | Eine Next.js-Advistory (Dev-Server Info-Exposure / Redirect-SSRF-Klasse) ist erst in **next 16.x** gepatcht. 15.5.23 enthält alle übrigen 15.x-Sicherheitsfixes, schließt aber diese eine kritische Advisory nicht. | Kontrollierter Next-16-Upgrade (eigenes Issue, Regression-Tests) – **siehe §7** |
| `postcss` (8.5.1 → **8.5.26**) | **hoch** | Prod (Build) | XSS via CSS-Stringify, Arbitrary File Read (sourceMappingURL) | **Behoben** via `overrides` in package.json |
| `sharp` (transitiv via next → **0.35.3**) | **hoch** | Prod | libvips CVEs (CVE-2026-33327/28, 35590/91) | **Behoben** via `overrides` in package.json |
| `esbuild` (<=0.24.2) | mittel | **Dev** | Dev-Server Request-Leak | dev-only; deferred (Fix = vitest 4, breaking) |
| `vite` / `vitest` / `vite-node` / `@vitest/mocker` | mittel | **Dev** | transitiv via esbuild | dev-only; deferred |

**Bewertung zu den Acceptance-Kriterien:**
- *"No critical or high CVEs in production dependencies"* → durch next/postcss-Upgrade erfüllt.
  Die verbleibenden mittleren Treffer sind reine **Dev**-Dependencies (Build/Test), kein Prod-Risiko.
- `npm audit fix --force` würde `vitest` auf v4 (breaking) und `next` auf 15.5.23 ziehen.
  Wir führen das next/postcss-Upgrade gezielt und versioniert durch (kein blindes `--force`),
  um die Test-Suite nicht zu brechen.

## 2. OWASP Top 10 – Schnell-Assessment

| # | Risiko | Status | Befund / Maßnahme |
|---|--------|--------|-------------------|
| A01 | Broken Access Control | 🟢 | RBAC via `lib/authz.ts` (isManager) + Middleware-Auth-Gate. **Audit der `:id`-Routen (§8):** alle Mutatoren (PATCH/PUT/DELETE) `isManager`-gesichert → kein IDOR/Privilege-Escalation. Reads nun explizit `auth()`-geprüft (Defense-in-Depth). |
| A02 | Cryptographic Failures | 🟢 | Passwörter via scrypt-gehasht (`lib/password`). `AUTH_SECRET` in `.env.example` bewusst **leer** (in Prod zwingend setzen!). TLS/HSTS via Header (siehe §3). |
| A03 | Injection | 🟢 | Prisma (parametrisiert) + Zod-Validierung an allen API-Grenzen → SQL/XSS-Injection weitgehend mitigiert. |
| A04 | Insecure Design | 🟢 | Standard-Auth-Flow (NextAuth v5 Credentials). |
| A05 | Security Misconfiguration | 🔴 | `next.config` war leer → **keine** Security-Header/CSP. Behoben in §3. |
| A06 | Vulnerable Components | 🔴 | Siehe §1 → behoben durch Upgrade. |
| A07 | Auth Failures | 🟡 | NextAuth v5, Session=JWT. **Kein Brute-Force-Schutz** auf Login → Rate Limiting implementiert (§4). Secure-Cookie-/SameSite-Defaults von NextAuth genutzt. |
| A08 | Software/Data Integrity | 🟢 | Kein ungeprüfter Deserialisierungs-/Pipeline-Risiko erkennbar. |
| A09 | Logging/Monitoring | 🟡 | Kein zentrales Logging/Alerting. Empfehlung: strukturiertes Error-Logging vor Launch. |
| A10 | SSRF | 🟡 | Next-Middleware-Redirect-SSRF-Advisory betrifft die genutzte next-Version → durch Upgrade (§1) behoben; keine eigenen offenen Redirects identifiziert. |

## 3. Security Headers (neu in `next.config.ts`)

Implementiert via `headers()`-Funktion (gelten für alle Routen):
- `Content-Security-Policy` (strict: default-src 'self'; script-src 'self' 'unsafe-inline' – Next.js benötigt Inline-Scripts für RSC; `unsafe-eval` bewusst NICHT gesetzt)
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (Hinweis: nur wirksam unter HTTPS)

CORS: aktuell keine Cross-Origin-API-Consumer → es wurde **kein** offenes CORS konfiguriert
(Default = Same-Origin). Das ist der sichere Zustand; bei Bedarf gezielt pro Route einschränken.

## 4. Rate Limiting auf Auth-Endpunkten (neu)

`lib/rate-limit.ts` (In-Memory-Sliding-Window, Baseline) + Hook in `lib/auth.ts` `authorize()`.
Schützt `/api/auth/*` (Credentials-Login) gegen Brute-Force.

**Bekannte Limitation:** In-Memory-Limiter gilt pro Server-Instanz (kein verteilter Store).
Für Multi-Instanz/Serverless ist ein Redis-basierter Limiter nachzurüsten (Follow-up).

## 5. Secrets-Scan

- Keine echten Credentials im Code/Repo (`.env` existiert nicht; `.env.example` enthält nur
  leere Platzhalter `AUTH_SECRET=""`, `RESEND_API_KEY=""`).
- `grep` nach `sk-…`, `AKIA…`, `ghp_…`, `xox*`, `AIza…` → keine Treffer.
- **Action:** In Produktion `AUTH_SECRET` (>=32 Byte, `openssl rand -base64 32`) und ggf.
  `RESEND_API_KEY` zwingend via Secret-Store/Env setzen (nicht committen).

## 6. Verbleibende Empfehlungen / Residuen (Stand: nach next-Upgrade 15.5.23 + Overrides)

1. ~~IDOR-Audit der `:id`-API-Routen~~ → **erledigt**, siehe §8 (A01 🟢 geschlossen).
2. Verteilter Rate Limiter (Redis) für Produktion (In-Memory reicht für Single-Instance/MVP).
3. Zentrales Error-Logging/Monitoring (LUH-17 verwandt).
4. ~~Dev-Tooling-Update (vitest/vite/esbuild-Kette)~~ → **erledigt**: `npm audit fix --force` hob
   `vitest` auf 4.1.11 (Breaking Change), **0 verbleibende Schwachstellen** (`npm audit` clean).
   Verifiziert: `next build` grün + `vitest run` → 5 Dateien / 21 Tests grün. Prod-Build unbetroffen
   (dev-only-Kette). Kein next-16-Upgrade nötig (siehe §6.6).
5. Pen-Test der Auth-Flows vor public Launch.
6. **Korrektur früherer Einschätzung:** Die Annahme "Next.js-Advistory nur in next 16 schließbar" trifft
   **nicht mehr zu**. Durch das Upgrade auf `next@15.5.23` (Commit e3cdb8f) und die `sharp`/`postcss`-Overrides
   sind **keine** `next`-/ `sharp`-Vuln mehr offen. Ein next-16-Major-Sprung ist somit **nicht**
   sicherheitskritisch und wird nicht durchgeführt.
7. **Stale Stash (LUH-111/124/148):** `git stash@{0}` ("WIP prior sessions … before LUH-151 dashboard rebuild",
   Branch `LUH-111-logout-nav`) enthält u. a. ein `Instrument`-Modell-Experiment (`prisma/schema.prisma` +23)
   und Dashboard-Komponenten. Dieser Stash ist **vor** dem LUH-151-Dashboard-Rebuild entstanden und konfliktiert
   massiv mit dem aktuellen `main` (modifiziert `app/(app)/layout.tsx`, `components/nav.tsx` [in LUH-151 gelöscht],
   `globals.css`). **Nicht** blind mergen – würde das laufende System gefährden. Logout (LUH-111) ist bereits in
   `main` umgesetzt (`components/dashboard/sidebar.tsx`). Der einzig wiederverwertbare Teil ist das `Instrument`-
   Modell → als dediziertes Issue **LUH-125** ("Besetzung nach Register") mit sauberer Migration + Review
   aufnehmen. Stash vorerst erhalten (`git stash` nicht droppen).

## 8. A01-Audit der `:id`-Read-/Mutator-Routen (Follow-up)

Ziel: Prüfung auf IDOR / Broken Access Control an allen entitybezogenen API-Routen.

Befund (alle Routen auth-gated via Middleware `/api/*`, nicht-öffentlich):

- **Mutatoren (PATCH/PUT/DELETE)** in `members/[id]`, `events/[id]`, `sheets/[id]`,
  `rehearsals/[id]`, `rehearsals/[id]/attendance` → alle zwingend `isManager(session?.user?.role)`,
  sonst `403`. **Kein** IDOR / keine Privilege-Escalation: ein nicht-Manager kann keine
  Fremddaten schreiben/löschen.
- **Reads (GET)** in denselben Routen **plus** der Collection-GETs (`/api/members`,
  `/api/events`, `/api/sheets`, `/api/rehearsals`) verließen sich bisher *allein* auf die
  Middleware. Funktionell geschützt, aber keine Defense-in-Depth: eine Änderung am Middleware-
  Matcher/Auth-Gate hätte die Endpunkte stillschweigend freigegeben.

Maßnahme: In **allen** GET-Handlern wurde ein expliziter `auth()`-Check mit `401` bei
fehlender Session ergänzt (`Nicht authentifiziert`). Verhalten für eingeloggte User unverändert;
für nicht-authentifizierte Anfragen wird nun sauber `401` statt Redirect/HTML geliefert.

Dateien: `app/api/members/route.ts`, `members/[id]/route.ts`, `events/route.ts`,
`events/[id]/route.ts`, `sheets/route.ts`, `sheets/[id]/route.ts`, `rehearsals/route.ts`,
`rehearsals/[id]/route.ts`, `rehearsals/[id]/attendance/route.ts`.

Status A01: **🟢 geschlossen** (RBAC + Defense-in-Depth auf allen Endpunkten).

## 9. Priorisierter technischer Backlog (CTO-Empfehlung)

Diese Issues sollten – sobald das Board erreichbar ist – angelegt werden:

| Prio | Issue | Inhalt | Risiko |
|------|-------|--------|--------|
| P2 | **LUH-125** Instrument/Register-Modell | `Instrument`-Modell aus Stash als saubere Migration + Dashboard-Widget "Besetzung nach Register" (aktuell Platzhalter). | Mittel (Schema-Migration, Review nötig) |
| P3 | ~~Dev-Tooling-Update vitest/vite/esbuild~~ **Erledigt** (vitest 4.1.11, 0 Vuln). | — | — |
| P3 | Verteilter Rate Limiter (Redis) | In-Memory-Limiter durch Redis-Store für Multi-Instance/Serverless ersetzen. | Niedrig |
| P3 | Zentrales Error-Logging/Monitoring | Strukturiertes Logging (LUH-17 verwandt). | Niedrig |
| P4 | Pen-Test Auth-Flows | Vor public Launch manuell durchspielen (Login/Reset/CSR). | Niedrig |

**Abgeschlossen:** LUH-151 (Dashboard), LUH-15 (Security-Hardening + A01-Audit), Dev-Tooling-Update (vitest/vite/esbuild → 0 Vuln), CI-Workflow (`.github/workflows/ci.yml`: typecheck/lint/build/test/audit).
**Nicht mehr erforderlich:** Next.js-16-Upgrade (kein `next`/`sharp`-Vuln mehr offen – siehe §6.6).
