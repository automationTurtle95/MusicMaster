import { prisma } from "@/lib/prisma";

/**
 * Datenaggregierung für das Dashboard (LUH-151).
 *
 * Wo ein fachliches Datenmodell in MusicMaster (noch) fehlt – konkret:
 *  - Offene Beiträge / Zahlungen (kein Payment-Modell)
 *  - Jahreskonzert-Termin (kein Event-Typ "Konzert" als KPI)
 *  - SolIst-Besetzung pro Register (Instrumentenmodell erst in Arbeit, s. LUH-125)
 * werden bewusst vereinfachte Platzhalter geliefert. Das ist im Abschluss-Kommentar
 * des Issues dokumentiert und nicht einfach weggelassen.
 */

const REGISTERS: { name: string; keywords: string[]; soll: number }[] = [
  { name: "Klarinette", keywords: ["klarinette"], soll: 10 },
  { name: "Flöte", keywords: ["flöte", "floete"], soll: 8 },
  { name: "Trompete", keywords: ["trompete"], soll: 8 },
  { name: "Posaune", keywords: ["posaune"], soll: 6 },
  { name: "Horn", keywords: ["horn"], soll: 5 },
  { name: "Tenorhorn/Bariton", keywords: ["tenorhorn", "bariton"], soll: 8 },
  { name: "Tuba", keywords: ["tuba"], soll: 4 },
  { name: "Schlagwerk", keywords: ["schlagwerk", "schlagzeug", "percussion"], soll: 5 },
];

export type RegisterStat = { name: string; ist: number; soll: number };

export type UpcomingEvent = {
  id: string;
  title: string;
  startsAt: Date;
  location: string;
  participants: number;
};

export type NextRehearsal = {
  id: string;
  title: string;
  startsAt: Date;
  location: string | null;
  notes: string | null;
  present: number;
  excused: number;
  open: number;
  totalActive: number;
} | null;

export type DashboardKpi = {
  activeMembers: number;
  memberDelta: number;
  newMembers: number;
  exitedMembers: number;
  attendanceRate: number; // Prozent, 0..100
  attendanceDeltaPlaceholder: string;
  openFees: { count: number; amount: string } | null; // null = Modell fehlt (Platzhalter)
  daysToConcert: number | null; // null bei vergangenem Platzhalter-Datum
  concertDate: string | null;
  concertPlace: string | null;
};

export type DashboardData = {
  counts: { members: number; rehearsals: number; sheets: number };
  kpi: DashboardKpi;
  nextRehearsal: NextRehearsal;
  registers: RegisterStat[];
  upcomingEvents: UpcomingEvent[];
};

export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    totalMembers,
    activeMembers,
    totalRehearsals,
    totalSheets,
    exitedMembers,
    newMembers,
    instrumentRows,
    recentRehearsals,
    nextRehearsalRaw,
    upcomingEventsRaw,
  ] = await Promise.all([
    prisma.member.count(),
    prisma.member.count({ where: { active: true } }),
    prisma.rehearsal.count(),
    prisma.sheetMusic.count(),
    prisma.member.count({ where: { active: false } }),
    prisma.member.count({ where: { joinedAt: { gte: ninetyDaysAgo } } }),
    prisma.member.findMany({ select: { instrument: true } }),
    prisma.rehearsal.findMany({
      orderBy: { startsAt: "desc" },
      take: 5,
      include: { attendances: true },
    }),
    prisma.rehearsal.findFirst({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      include: { attendances: true },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 5,
      include: { _count: { select: { eventMembers: true } } },
    }),
  ]);

  // Ø Anwesenheit über die letzten bis zu 5 Gesamtproben mit erfassten Daten.
  const rates = recentRehearsals
    .map((r) => {
      const total = r.attendances.length;
      if (total === 0) return null;
      const present = r.attendances.filter((a) => a.status === "PRESENT").length;
      return present / total;
    })
    .filter((r): r is number => r !== null);
  const attendanceRate =
    rates.length > 0 ? (rates.reduce((a, b) => a + b, 0) / rates.length) * 100 : 0;

  const nextRehearsal: NextRehearsal = nextRehearsalRaw
    ? (() => {
        const present = nextRehearsalRaw.attendances.filter(
          (a) => a.status === "PRESENT"
        ).length;
        const excused = nextRehearsalRaw.attendances.filter(
          (a) => a.status === "EXCUSED"
        ).length;
        const recorded = nextRehearsalRaw.attendances.length;
        const open = Math.max(0, activeMembers - recorded);
        return {
          id: nextRehearsalRaw.id,
          title: nextRehearsalRaw.title,
          startsAt: nextRehearsalRaw.startsAt,
          location: nextRehearsalRaw.location,
          notes: nextRehearsalRaw.notes,
          present,
          excused,
          open,
          totalActive: activeMembers,
        };
      })()
    : null;

  const registers: RegisterStat[] = REGISTERS.map((reg) => {
    const ist = instrumentRows.filter((m) =>
      reg.keywords.some((kw) => m.instrument?.toLowerCase().includes(kw))
    ).length;
    return { name: reg.name, ist, soll: reg.soll };
  });

  // Jahreskonzert: Platzhalter-Datum (kein eigenes Modell vorhanden).
  const concertDate = new Date("2026-12-19T00:00:00");
  const daysToConcertRaw = Math.ceil(
    (concertDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );
  const daysToConcert = daysToConcertRaw > 0 ? daysToConcertRaw : null;

  const kpi: DashboardKpi = {
    activeMembers,
    memberDelta: newMembers - exitedMembers,
    newMembers,
    exitedMembers,
    attendanceRate,
    attendanceDeltaPlaceholder: "+2,1 %",
    openFees: null,
    daysToConcert,
    concertDate: "Sa, 19.12.2026",
    concertPlace: "Aula",
  };

  return {
    counts: { members: totalMembers, rehearsals: totalRehearsals, sheets: totalSheets },
    kpi,
    nextRehearsal,
    registers,
    upcomingEvents: upcomingEventsRaw.map((e) => ({
      id: e.id,
      title: e.title,
      startsAt: e.startsAt,
      location: e.location,
      participants: e._count.eventMembers,
    })),
  };
}

export function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Guten Morgen";
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

export function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((d.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  return week;
}
