export type CalendarRehearsal = {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
};

// "YYYY-MM-DD" im lokalen Kalender (konsistent mit der Anzeige der Probenzeiten).
export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Wochentag Montag-basiert: 0=Mo … 6=So
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// 6×7-Matrix von Datumswerten, die den Monat vollständig abdeckt
// (inkl. Randtage benachbarter Monate), Wochen beginnen montags.
export function getMonthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - mondayIndex(first));
  const weeks: Date[][] = [];
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// 7 Tage, beginnend mit dem Montag der Woche, die `reference` enthält.
export function getWeekDays(reference: Date): Date[] {
  const ref = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate()
  );
  const start = new Date(
    ref.getFullYear(),
    ref.getMonth(),
    ref.getDate() - mondayIndex(ref)
  );
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

// Gruppiert Proben nach lokalem Tag (YYYY-MM-DD), je Tag aufsteigend nach Uhrzeit.
export function groupRehearsalsByDay(
  rehearsals: CalendarRehearsal[]
): Map<string, CalendarRehearsal[]> {
  const map = new Map<string, CalendarRehearsal[]>();
  for (const r of rehearsals) {
    const key = toDayKey(new Date(r.startsAt));
    const arr = map.get(key) ?? [];
    arr.push(r);
    arr.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    map.set(key, arr);
  }
  return map;
}
