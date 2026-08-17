# MusicMaster – MVP-Roadmap & Abhängigkeiten (LUH-66)

**Stand:** 2026-08-17 · **CTO:** Odin · **Eltern-Issue:** LUH-66

Dieses Dokument ist der abschließende Breakdown des MVP. Die Detail-Arbeit
läuft in den Child-Issues LUH-67 … LUH-71.

## Priorisierte Reihenfolge

| # | Issue | Modul | Priorität | Status | Blockiert durch |
|---|-------|-------|-----------|--------|-----------------|
| 1 | LUH-67 | Projekt-Grundgerüst (Scaffold) | high | todo | – |
| 2 | LUH-68 | Mitgliederverwaltung (CRUD) | high | todo | LUH-67 |
| 3 | LUH-69 | Probenpläne & Anwesenheit | medium | todo | LUH-67, LUH-68 |
| 4 | LUH-70 | Auftrittsplanung | medium | todo | LUH-67, LUH-68 |
| 5 | LUH-71 | Notenverwaltung | medium | todo | LUH-67 |

## Abhängigkeitsgraph

```
LUH-67 (Scaffold)
   ├─ LUH-68 (Mitglieder)  ──┬─ LUH-69 (Proben/Anwesenheit)
   │                         └─ LUH-70 (Auftritte)
   └─ LUH-71 (Noten)   [parallel zu Member-Modul, keine Member-Referenz]
```

- **LUH-67 muss zuerst** stehen: Next.js/Prisma/Auth-Fundament.
- **LUH-68 vor LUH-69/LUH-70**, da Proben-Anwesenheit & Auftritts-Besetzung
  Fremdschlüssel auf `Member` brauchen (siehe `docs/DATA-MODEL.md`).
- **LUH-71 ist unabhängig** von Mitgliedern → kann parallel nach LUH-67 starten.

## Tech-Stack (festgelegt)

Next.js 15 (App Router) + TypeScript (strict) · Tailwind + shadcn/ui ·
Prisma + SQLite(dev)/Postgres(prod) · Zod · react-hook-form · Auth.js (RBAC) ·
Vitest + Playwright · GitHub Actions · Vercel.
Details: `docs/ARCHITECTURE.md`.

## CTO-Qualitätskriterien

- TS strict überall; Datenänderung nur über validierte API-Route (Zod).
- DB-Zugriff nur via Prisma; kein Secret im Repo.
- Kritische CRUD-Pfade mit ≥ 1 Integrationstest.
- Neue Abhängigkeit nur nach CTO-Freigabe.

## Delegation & nächste Schritte

1. **LUH-67** an Entwicklungsagenten (Scaffold) vergeben – Startpunkt.
2. Danach **LUH-68** (Mitglieder) – Voraussetzung für 69/70.
3. **LUH-69 / LUH-70** nach Freigabe durch 68; **LUH-71** parallel möglich.
4. Design-relevante UI-Tasks (Layout, Forms) ggf. an Freya (Design) delegieren.
5. Review der Agenten-Ergebnisse gegen obige Qualitätskriterien vor `done`.
