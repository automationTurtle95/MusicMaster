"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Member = { id: string; firstName: string; lastName: string; active: boolean };
type Rehearsal = {
  id: string;
  title: string;
  startsAt: string;
  _count?: { attendances: number };
};
type EventItem = { id: string; title: string; startsAt: string; location: string };
type Sheet = { id: string; title: string };
type Attendance = { id: string; status: "PRESENT" | "EXCUSED" | "ABSENT" };

const STATUS_LABEL: Record<Attendance["status"], string> = {
  PRESENT: "Anwesend",
  EXCUSED: "Entschuldigt",
  ABSENT: "Fehlt",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function DashboardOverview() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [memberCount, setMemberCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  const [upcomingRehearsals, setUpcomingRehearsals] = useState<Rehearsal[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<EventItem[]>([]);
  const [sheetCount, setSheetCount] = useState(0);

  const [attendanceSummary, setAttendanceSummary] = useState<{
    date: string;
    counts: Record<Attendance["status"], number>;
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [membersRes, rehearsalsRes, eventsRes, sheetsRes] = await Promise.all([
          fetch("/api/members"),
          fetch("/api/rehearsals"),
          fetch("/api/events"),
          fetch("/api/sheets"),
        ]);

        if (
          !membersRes.ok ||
          !rehearsalsRes.ok ||
          !eventsRes.ok ||
          !sheetsRes.ok
        ) {
          throw new Error("Ein Modul lieferte keine Daten.");
        }

        const members: Member[] = (await membersRes.json()).members ?? [];
        const rehearsals: Rehearsal[] = (await rehearsalsRes.json()).rehearsals ?? [];
        const events: EventItem[] = (await eventsRes.json()).events ?? [];
        const sheets: Sheet[] = (await sheetsRes.json()).sheets ?? [];

        const now = new Date();
        const isUpcoming = (iso: string) => new Date(iso).getTime() >= now.getTime();

        setMemberCount(members.length);
        setActiveCount(members.filter((m) => m.active).length);
        setSheetCount(sheets.length);

        setUpcomingRehearsals(
          rehearsals
            .filter((r) => isUpcoming(r.startsAt))
            .sort(
              (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
            )
        );
        setUpcomingEvents(
          events
            .filter((e) => isUpcoming(e.startsAt))
            .sort(
              (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
            )
        );

        const byTimeDesc = (a: Rehearsal, b: Rehearsal) =>
          new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime();
        const pastRehearsals = rehearsals
          .filter((r) => new Date(r.startsAt).getTime() < now.getTime())
          .sort(byTimeDesc);
        const latest = pastRehearsals[0] ?? rehearsals.slice().sort(byTimeDesc)[0];
        if (latest) {
          const attRes = await fetch(`/api/rehearsals/${latest.id}/attendance`);
          if (attRes.ok) {
            const attendance: Attendance[] = (await attRes.json()).attendance ?? [];
            const counts: Record<Attendance["status"], number> = {
              PRESENT: 0,
              EXCUSED: 0,
              ABSENT: 0,
            };
            for (const a of attendance) counts[a.status] += 1;
            setAttendanceSummary({ date: latest.startsAt, counts });
          }
        }
      } catch {
        setError("Übersicht konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">Lade Live-Übersicht…</p>
    );
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  const nextRehearsal = upcomingRehearsals[0];
  const nextConcert = upcomingEvents[0];
  const daysUntilConcert = nextConcert
    ? daysBetween(new Date(), new Date(nextConcert.startsAt))
    : null;

  const attendanceTotal = attendanceSummary
    ? attendanceSummary.counts.PRESENT +
      attendanceSummary.counts.EXCUSED +
      attendanceSummary.counts.ABSENT
    : 0;
  const attendancePct =
    attendanceSummary && attendanceTotal > 0
      ? Math.round((attendanceSummary.counts.PRESENT / attendanceTotal) * 100)
      : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aktive Mitglieder</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{activeCount}</p>
            <p className="text-sm text-muted-foreground">
              von {memberCount} gesamt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anwesenheit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {attendancePct !== null ? `${attendancePct}%` : "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              letzte Auswertung
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anstehende Proben</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {upcomingRehearsals.length}
            </p>
            <p className="text-sm text-muted-foreground">ab heute geplant</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tage bis nächstem Konzert</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {daysUntilConcert !== null ? daysUntilConcert : "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              {nextConcert ? nextConcert.title : "kein Termin"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Noten im Bestand</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{sheetCount}</p>
            <p className="text-sm text-muted-foreground">
              Notenstücke katalogisiert
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="text-base">Nächste Gesamtprobe</CardTitle>
          </CardHeader>
          <CardContent>
            {!nextRehearsal ? (
              <p className="text-sm text-muted-foreground">
                Keine anstehende Probe geplant.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-semibold">{nextRehearsal.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(nextRehearsal.startsAt)} ·{" "}
                    {formatTime(nextRehearsal.startsAt)}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/rehearsals">Proben öffnen</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Anstehende Termine</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingRehearsals.length === 0 && upcomingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine anstehenden Proben oder Auftritte.
              </p>
            ) : (
              <ul className="divide-y">
                {upcomingRehearsals.slice(0, 4).map((r) => (
                  <li key={`r-${r.id}`} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Probe: {r.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.startsAt)} · {formatTime(r.startsAt)}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/rehearsals">Öffnen</Link>
                    </Button>
                  </li>
                ))}
                {upcomingEvents.slice(0, 4).map((e) => (
                  <li key={`e-${e.id}`} className="flex items-center justify-between py-2">
                    <div>
                      <p className="font-medium">Auftritt: {e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(e.startsAt)} · {formatTime(e.startsAt)}
                        {e.location ? ` · ${e.location}` : ""}
                      </p>
                    </div>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/events">Öffnen</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
