import { RehearsalsManager } from "@/components/rehearsals-manager";
import { RehearsalCalendar } from "@/components/rehearsal-calendar";

export default function RehearsalsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Proben</h1>
      <p className="text-muted-foreground">
        Proben planen und Anwesenheit (da/entschuldigt/fehlt) je Mitglied erfassen.
      </p>
      <RehearsalCalendar />
      <RehearsalsManager />
    </div>
  );
}
