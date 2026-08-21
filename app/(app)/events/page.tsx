import { EventsManager } from "@/components/events-manager";

export default function EventsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Auftritte</h1>
        <p className="text-muted-foreground">
          Auftritte planen und Besetzungen mit Rollen erfassen.
        </p>
      </div>
      <EventsManager />
    </div>
  );
}
