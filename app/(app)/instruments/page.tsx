import { InstrumentsManager } from "@/components/instruments-manager";

export default function InstrumentsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Instrumente</h1>
        <p className="text-muted-foreground">
          Vereinseigentum verwalten: Register, Inventarnummer, Zustand und
          Verleih an Mitglieder.
        </p>
      </div>
      <InstrumentsManager />
    </div>
  );
}
