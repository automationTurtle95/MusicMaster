import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NextRehearsal as NextRehearsalData } from "@/lib/dashboard";

export function NextRehearsalWidget({ rehearsal }: { rehearsal: NextRehearsalData }) {
  if (!rehearsal) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nächste Gesamtprobe</CardTitle>
          <CardDescription>Zugesagt / Abgesagt / Offen</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Keine Gesamtprobe geplant. (Platzhalter – sobald ein Termin angelegt
            ist, werden Zusagen automatisch ausgewiesen.)
          </p>
        </CardContent>
      </Card>
    );
  }

  const date = new Date(rehearsal.startsAt);
  const month = date.toLocaleDateString("de-DE", { month: "short" });
  const day = date.getDate();
  const time = date.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const total = Math.max(1, rehearsal.totalActive);
  const pct = Math.round((rehearsal.present / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nächste Gesamtprobe</CardTitle>
        <CardDescription>Zugesagt / Abgesagt / Offen</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
            <span className="text-xs uppercase">{month}</span>
            <span className="text-3xl font-bold leading-none">{day}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{rehearsal.title}</p>
            <p className="text-sm text-muted-foreground">{time} Uhr</p>
            {rehearsal.location && (
              <p className="truncate text-sm text-muted-foreground">
                {rehearsal.location}
              </p>
            )}
            {rehearsal.notes && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {rehearsal.notes}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p className="text-lg font-semibold text-[#4f7a52]">
              {rehearsal.present}
            </p>
            <p className="text-xs text-muted-foreground">Zugesagt</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-destructive">
              {rehearsal.excused}
            </p>
            <p className="text-xs text-muted-foreground">Abgesagt</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{rehearsal.open}</p>
            <p className="text-xs text-muted-foreground">Offen</p>
          </div>
        </div>

        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-[#4f7a52]"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="mt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/rehearsals">Öffnen</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
