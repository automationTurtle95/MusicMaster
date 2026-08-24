import { describe, expect, it } from "vitest";

import {
  getMonthMatrix,
  getWeekDays,
  groupRehearsalsByDay,
  toDayKey,
  type CalendarRehearsal,
} from "@/lib/calendar";

describe("calendar helpers", () => {
  it("toDayKey liefert lokales YYYY-MM-DD", () => {
    expect(toDayKey(new Date(2026, 8, 1))).toBe("2026-09-01");
    expect(toDayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("getMonthMatrix liefert 6×7 Tage, Montag-Start, deckt den Monat ab", () => {
    const matrix = getMonthMatrix(2026, 8); // September 2026
    expect(matrix).toHaveLength(6);
    expect(matrix[0]).toHaveLength(7);

    // Erste Zelle ist ein Montag.
    const first = matrix[0][0];
    expect(first.getDay()).toBe(1);

    // Jeder Tag im September liegt in der Matrix.
    const flat = matrix.flat();
    for (let day = 1; day <= 30; day++) {
      expect(flat.some((d) => d.getMonth() === 8 && d.getDate() === day)).toBe(
        true
      );
    }
  });

  it("getWeekDays liefert 7 Tage ab Montag der Referenzwoche", () => {
    // 15.09.2026 ist ein Dienstag (Wochenstart = 14.09. Mo).
    const days = getWeekDays(new Date(2026, 8, 15));
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Montag
    expect(days[0].getDate()).toBe(14);
    expect(days[6].getDate()).toBe(20);
  });

  it("groupRehearsalsByDay gruppiert nach Tag und sortiert aufsteigend", () => {
    const items: CalendarRehearsal[] = [
      { id: "a", title: "Abend", startsAt: "2026-09-01T19:00:00", location: null },
      { id: "b", title: "Morgens", startsAt: "2026-09-01T09:00:00", location: null },
      { id: "c", title: "AndererTag", startsAt: "2026-09-02T10:00:00", location: null },
    ];
    const grouped = groupRehearsalsByDay(items);
    expect(grouped.get("2026-09-01")?.map((r) => r.id)).toEqual(["b", "a"]);
    expect(grouped.get("2026-09-02")?.map((r) => r.id)).toEqual(["c"]);
    expect(grouped.get("2026-09-03")).toBeUndefined();
  });
});
