import Link from "next/link";

import { auth } from "@/lib/auth";
import { getDashboardData, getGreeting } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { ExportButton } from "@/components/dashboard/export-button";
import { KpiTiles } from "@/components/dashboard/kpi-tiles";
import { NextRehearsalWidget } from "@/components/dashboard/next-rehearsal";
import { RegisterChart } from "@/components/dashboard/register-chart";
import { UpcomingEvents } from "@/components/dashboard/upcoming-events";
import { TodoList } from "@/components/dashboard/todo-list";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? "";
  const firstName = name.split(" ")[0] || "Mitglied";
  const greeting = getGreeting(new Date());

  const data = await getDashboardData();

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Übersicht · Saison 2026/27
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Der aktuelle Stand deines Vereins auf einen Blick.
          </p>
        </div>
        <div className="flex gap-2">
          <ExportButton />
          <Button asChild>
            <Link href="/rehearsals">Termin anlegen</Link>
          </Button>
        </div>
      </header>

      <KpiTiles kpi={data.kpi} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <NextRehearsalWidget rehearsal={data.nextRehearsal} />
          <RegisterChart registers={data.registers} />
        </div>
        <div className="space-y-6">
          <UpcomingEvents events={data.upcomingEvents} />
          <TodoList />
        </div>
      </div>
    </div>
  );
}
