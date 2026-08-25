# MusicMaster – Technische Architektur & Stack-Entscheidung

**Status:** Entscheidung (Kickoff) – Stand 2026-08-17
**Verantwortlich:** CTO (Odin)
**Issue:** LUH-66

## 1. Ziel & Randbedingungen

MusicMaster ist eine webbasierte Verwaltungssoftware für Musikvereine (Mitglieder,
Proben, Auftritte, Noten). MVP-Umfang siehe `README.md` / Projektbeschreibung.

Randbedingungen, die den Stack wählen lassen:

- CRUD-lastige Fachanwendung mit relationalen Daten (Mitglieder ↔ Proben ↔ Anwesenheit).
- Kleines Team, geringe Betriebskomplexität erwünscht → möglichst eine Codebasis,
  ein Deploy-Target.
- Lokale Entwicklung ohne Server-Setup möglich (Zero-Config-DB).
- Sprache des Produkts: Deutsch → UI-Texte deutsch, Code/Kommentare englisch.

## 2. Stack-Entscheidung

| Bereich        | Wahl                                   | Begründung |
|----------------|----------------------------------------|------------|
| Framework      | **Next.js 15 (App Router) + TypeScript** | Ein Full-Stack-Framework: UI + API-Routes in einem Repo, ein Deploy. App Router = modernes Routing, Server Components für Performance. |
| UI / Styling   | **Tailwind CSS + shadcn/ui**           | Schnelles, konsistentes, barrierearmes UI ohne eigenes Design-System. Komponenten sind kopierbarer Code (kein Lock-in). |
| ORM / DB       | **Prisma + SQLite (dev) → PostgreSQL (prod)** | Typisierter Datenzugriff, einfache Migrationen. SQLite für Zero-Config-lokale Entwicklung, gleiches Schema in Postgres für Prod. |
| Validierung    | **Zod**                                | Schema-Validierung an API-Grenzen, wiederverwendbar für Forms. |
| Forms          | **react-hook-form**                    | Performante Forms, gute Zod-Integration. |
| Auth           | **Auth.js (NextAuth) – Credentials/Email** | Standard-Lösung für Next.js, keine eigene Auth nötig. Rollen (Admin/Vorstand/Mitglied) als einfaches RBAC. |
| Tests          | **Vitest** (Unit/Integration) + **Playwright** (E2E) | Schnell, im Next-Ökosystem etabliert. |
| CI/CD          | **GitHub Actions**                     | Lint, Typecheck, Tests, Build bei jedem PR. |
| Deploy         | **Vercel** (oder Docker-Image)         | Next.js-nativ, einfach. Postgres via Managed-DB (z. B. Supabase/Neon). |

**Bewusst nicht** gewählt: separates Backend (z. B. NestJS/Spring) – unnötige
Komplexität für den MVP; Microservices – frühes Over-Engineering.

## 3. Projektstruktur (MVP)

```
/
├─ app/                 # App Router: pages + route handlers (API)
│  ├─ (auth)/
│  ├─ members/          # Mitgliederverwaltung
│  ├─ rehearsals/       # Proben + Anwesenheit
│  ├─ events/           # Auftrittsplanung
│  └─ sheets/           # Notenverwaltung
├─ components/ui/       # shadcn/ui
├─ lib/                 # prisma client, auth, utils
├─ prisma/
│  └─ schema.prisma     # Datenmodell + Migrationen
├─ tests/
└─ docs/                # Architektur, Datenmodell, Entscheidungen
```

## 4. Qualitätskriterien (CTO-Vorgaben)

- TypeScript strict mode überall.
- Jede Datenänderung läuft über validierte API-Route (Zod), nie direkt aus dem Client.
- DB-Zugriff nur über Prisma (kein rohes SQL außerhalb von Migrationen).
- 100 % der kritischen Pfade (CRUD) mit mindestens einem Integrationstest.
- Kein Secrets im Repo; `.env` via `.gitignore` (bereits vorhanden).
- Verbot von unnötigen Abhängigkeiten: neue Lib nur nach CTO-Freigabe.

## 5. Risiken & Abhängigkeiten

- **Auth/Rollen** ist querschnittlich → vor Modul-CRUD finalisieren (siehe Scaffold).
- **Datei-Upload für Noten** benötigt Storage-Strategie (lokal vs. S3-kompatibel);
  im MVP zuerst lokal/DB-Referenz, später objektbasiert.

### 5.1 Entscheidung Noten-Datei-Upload (LUH-118, Stand 2026-08-25)

MVP = **lokale Dateiablage**, keine Schema-Änderung an `SheetMusic` (die Felder
`storage` und `fileUrl` existieren bereits).

- Upload: `POST /api/sheets/upload` (nur Manager) – validiert Typ (`application/pdf`),
  Magic-Bytes (`%PDF-`) und Größe (20 MB), speichert nach `SHEET_STORAGE_DIR`
  (`storage/sheets/<uuid>.pdf`) und liefert `fileUrl = /api/sheets/file/<uuid>.pdf` zurück.
- Verknüpfung: Das zurückgegebene `fileUrl` wird per `PATCH /api/sheets/[id]` am
  Notenstück gesetzt (bereits vorhanden).
- Auslieferung: `GET /api/sheets/[id]/file` (jeder angemeldete Nutzer) – löst das
  `fileUrl` auf; externe Links (`://`) werden per 302 umgeleitet, interne Token
  aus dem persistenten Speicher ausgeliefert. Pfad-Traversal ausgeschlossen, da der
  Dateiname immer `<uuid>.pdf` ist.
- Cleanup: `DELETE /api/sheets/[id]` löscht die verknüpfte Datei mit.
- **Bewusst noch offen (eigene Issues):** S3-kompatible Storage-Variante und ein
  UI-Upload-Feld war bereits Teil des Managers; ein nutzbares MVP ist ohne
  S3/Objektstorage erreicht.
- **Mehrsprachigkeit** vorerst nur DE; i18n-Struktur sauber halten, aber nicht ausbauen.

## 6. Nächste Schritte

Siehe Child-Issues (LUH-…): Scaffold, Mitgliederverwaltung, Proben/Anwesenheit,
Auftrittsplanung, Notenverwaltung. Reihenfolge & Abhängigkeiten dort definiert.
