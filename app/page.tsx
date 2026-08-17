import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  { href: "/members", title: "Mitglieder", description: "Kontaktdaten, Instrument, Aktivstatus" },
  { href: "/rehearsals", title: "Proben", description: "Probenpläne & Anwesenheit" },
  { href: "/events", title: "Auftritte", description: "Auftrittsplanung & Besetzung" },
  { href: "/sheets", title: "Noten", description: "Notenverwaltung & Lagerort" },
];

export default function HomePage() {
  return (
    <main className="container py-12">
      <div className="mb-10 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">MusicMaster</h1>
        <p className="text-muted-foreground">
          Verwaltungssoftware für Musikvereine – Mitglieder, Proben, Auftritte und Noten an einem Ort.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map((m) => (
          <Card key={m.href}>
            <CardHeader>
              <CardTitle className="text-xl">{m.title}</CardTitle>
              <CardDescription>{m.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href={m.href}>Öffnen</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
