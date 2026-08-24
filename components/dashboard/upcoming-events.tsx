import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { UpcomingEvent } from "@/lib/dashboard";

const BORDER_COLORS = ["#b06a17", "#4f7a52", "#a13b2f", "#6b6155", "#b06a17"];

export function UpcomingEvents({ events }: { events: UpcomingEvent[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anstehende Termine</CardTitle>
        <CardDescription>Auftritte & Veranstaltungen</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Keine anstehenden Termine erfasst. (Platzhalter – Termine werden aus
            dem Auftrittsmodul übernommen.)
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((event, i) => {
              const date = new Date(event.startsAt);
              const day = date.getDate();
              const month = date.toLocaleDateString("de-DE", { month: "short" });
              const time = date.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={event.id}
                  className="flex gap-3 rounded-md border-l-4 bg-card p-3"
                  style={{ borderLeftColor: BORDER_COLORS[i % BORDER_COLORS.length] }}
                >
                  <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-muted text-center">
                    <span className="text-lg font-bold leading-none">{day}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {month}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href="/events"
                      className="block truncate font-medium hover:underline"
                    >
                      {event.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {time} Uhr · {event.location}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {event.participants} Teilnehmer
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
