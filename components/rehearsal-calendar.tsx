"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getMonthMatrix,
  getWeekDays,
  groupRehearsalsByDay,
  toDayKey,
  type CalendarRehearsal,
} from "@/lib/calendar";

type View = "month" | "week";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monthTitle(d: Date): string {
  return d.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
}

function weekTitle(days: Date[]): string {
  const start = days[0].toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
  const end = days[6].toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${start} – ${end}`;
}

export function RehearsalCalendar() {
  const [rehearsals, setRehearsals] = useState<CalendarRehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/rehearsals")
      .then((res) => (res.ok ? res.json() : { rehearsals: [] }))
      .then((data) => {
        if (active) setRehearsals(data.rehearsals ?? []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const byDay = useMemo(
    () => groupRehearsalsByDay(rehearsals),
    [rehearsals]
  );

  const todayKey = toDayKey(new Date());

  function shift(delta: number) {
    setCursor((c) => {
      if (view === "month") {
        return new Date(c.getFullYear(), c.getMonth() + delta, 1);
      }
      const d = new Date(c);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  const monthMatrix =
    view === "month"
      ? getMonthMatrix(cursor.getFullYear(), cursor.getMonth())
      : null;
  const weekDays = view === "week" ? getWeekDays(cursor) : null;

  const title =
    view === "month"
      ? monthTitle(cursor)
      : weekDays
        ? weekTitle(weekDays)
        : "";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Kalender – Proben</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={view === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("month")}
            >
              Monat
            </Button>
            <Button
              variant={view === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("week")}
            >
              Woche
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => shift(-1)}>
            Zurück
          </Button>
          <span className="min-w-[180px] text-center font-medium">{title}</span>
          <Button variant="outline" size="sm" onClick={() => shift(1)}>
            Weiter
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Heute
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : view === "month" ? (
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {WEEKDAYS.map((w) => (
              <div key={w} className="pb-1 font-medium text-muted-foreground">
                {w}
              </div>
            ))}
            {monthMatrix!.flat().map((d) => {
              const key = toDayKey(d);
              const inMonth = d.getMonth() === cursor.getMonth();
              const items = byDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-[72px] rounded border p-1 text-left ${
                    inMonth ? "" : "bg-muted/40 text-muted-foreground"
                  } ${key === todayKey ? "border-primary" : "border-border"}`}
                >
                  <div className="font-medium">{d.getDate()}</div>
                  {items.slice(0, 3).map((r) => (
                    <div key={r.id} className="truncate text-[11px]" title={r.title}>
                      {formatTime(r.startsAt)} {r.title}
                    </div>
                  ))}
                  {items.length > 3 && (
                    <div className="text-[11px] text-muted-foreground">
                      +{items.length - 3} weitere
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {weekDays!.map((d) => {
              const key = toDayKey(d);
              const items = byDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-[160px] rounded border p-1 ${
                    key === todayKey ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="text-center text-xs font-medium">
                    {d.toLocaleDateString("de-DE", { weekday: "short" })}
                    <br />
                    {d.getDate()}.{d.getMonth() + 1}.
                  </div>
                  <div className="mt-1 space-y-1">
                    {items.map((r) => (
                      <div
                        key={r.id}
                        className="rounded bg-primary/10 p-1 text-[11px]"
                        title={r.title}
                      >
                        {formatTime(r.startsAt)} {r.title}
                        {r.location ? (
                          <span className="block text-muted-foreground">
                            {r.location}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
