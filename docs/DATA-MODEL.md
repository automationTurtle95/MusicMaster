# MusicMaster – Datenmodell (Skizze MVP)

**Stand:** 2026-08-17 · **Issue:** LUH-66

Skizze der Kernentitäten für den MVP. Finale Felder werden im Scaffold in
`prisma/schema.prisma` definiert. IDs sind UUIDs, Timestamps `DateTime`.

## Entitäten

### Member (Mitglied)
| Feld         | Typ            | Anmerkung |
|--------------|----------------|-----------|
| id           | UUID           | PK |
| firstName    | String         | |
| lastName     | String         | |
| email        | String?        | unique, optional |
| phone        | String?        | |
| street, city, zip | String?   | Adresse |
| instrument   | String         | z. B. "Trompete", "Schlagzeug" |
| active       | Boolean        | Aktivstatus (default true) |
| joinedAt     | DateTime?      | Eintrittsdatum |
| notes        | String?        | |
| createdAt / updatedAt | DateTime | |

### Rehearsal (Probe)
| Feld      | Typ       | Anmerkung |
|-----------|-----------|-----------|
| id        | UUID      | PK |
| title     | String    | |
| startsAt  | DateTime  | |
| location  | String?   | |
| notes     | String?   | |

### Attendance (Anwesenheit)
| Feld        | Typ          | Anmerkung |
|-------------|--------------|-----------|
| id          | UUID         | PK |
| rehearsalId | UUID         | FK → Rehearsal |
| memberId    | UUID         | FK → Member |
| status      | Enum         | PRESENT / EXCUSED / ABSENT |
| note        | String?      | |

*Unique(rehearsalId, memberId).*

### Event (Auftritt)
| Feld      | Typ       | Anmerkung |
|-----------|-----------|-----------|
| id        | UUID      | PK |
| title     | String    | |
| startsAt  | DateTime  | |
| location  | String    | |
| notes     | String?   | |

### EventMember (Besetzung)
| Feld      | Typ       | Anmerkung |
|-----------|-----------|-----------|
| id        | UUID      | PK |
| eventId   | UUID      | FK → Event |
| memberId  | UUID      | FK → Member |
| role      | String?   | z. B. "Solist", "Begleitung" |

*Unique(eventId, memberId).*

### SheetMusic (Noten)
| Feld       | Typ       | Anmerkung |
|------------|-----------|-----------|
| id         | UUID      | PK |
| title      | String    | |
| composer   | String?   | |
| genre      | String?   | |
| difficulty | Enum?     | LEICHT / MITTEL / SCHWER |
| storage    | String?   | Ort/Lager (z. B. "Regal A3") |
| fileUrl    | String?   | Upload-Link (später) |
| notes      | String?   | |

### Account / User (Auth)
| Feld      | Typ       | Anmerkung |
|-----------|-----------|-----------|
| id        | UUID      | PK |
| email     | String    | unique |
| role      | Enum      | ADMIN / BOARD / MEMBER |
| memberId  | UUID?     | FK → Member (optional verknüpft) |

## Beziehungen (ER-Kurzform)

```
Member 1──* Attendance *──1 Rehearsal
Member 1──* EventMember *──1 Event
Rehearsal 1──* Attendance
Event     1──* EventMember
Member 1──0..1 Account
```

## Hinweise

- Anwesenheit & Besetzung referenzieren `Member` → Mitgliederverwaltung muss
  **vor** Proben- und Auftrittsmodul stehen (Fremdschlüssel).
- Soft-Delete ist für MVP nicht nötig; `active=false` reicht für Mitglieder.
- Notenverwaltung ist unabhängig von Membern → kann parallel zum Member-Modul starten.
