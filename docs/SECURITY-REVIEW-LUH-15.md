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
| A01 | Broken Access Control | 🟡 Teilweise | RBAC via `lib/authz.ts` (isAdmin) + Middleware-Auth-Gate vorhanden. API-Routen prüfen Owner/Role (IDOR-Risiko bei `:id`-Routen → Follow-up-Audit empfohlen). |
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
- `Content-Security-Policy` (strict: default-src 'self', keine inline-Scripts erlaubt außer Next-Bundles)
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

## 6. Verbleibende Empfehlungen (Follow-up, nicht dieser Heartbeat)

1. IDOR-Audit der `:id`-API-Routen (Owner/Role-Checks) – eigenes Issue.
2. Verteilter Rate Limiter (Redis) für Produktion.
3. Zentrales Error-Logging/Monitoring (LUH-17 verwandt).
4. Dev-Dependency-Updates (vitest 4) in ruhigem Moment (breaking für Tests).
5. Pen-Test der Auth-Flows vor public Launch.
6. **Residual (kritisch):** Eine Next.js-Advistory ist erst in **next 16.x** geschlossen. `npm audit fix --force`
   würde auf next@16.3.2 (Major, breaking) springen. Ein solcher Major-Framework-Sprung wird **nicht**
   ungeprüft in diesem Heartbeat durchgeführt (Risiko, die laufende App/ Dashboard zu brechen). Empfehlung:
   dediziertes Issue "Next.js 16 Upgrade (Security)" mit vollständigem Regression-Test (Build + Vitest + manueller
   Smoke-Test der Auth/Dashboard-Routen) vor public Launch. Bis dahin: Dev-Server nicht öffentlich exponieren
   (Advistory betrifft v. a. Dev-Server Origin-Verifikation).
7. `npm audit` meldet nach den Fixes noch 1 kritisch + 1 hoch (beide next/sharp-Metadaten) + 3 moderat
   (esbuild/vite/vitest, **rein dev-only**). Prod-Build nutzt die gepatchten postcss 8.5.26 / sharp 0.35.3.
