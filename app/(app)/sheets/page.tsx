import { SheetsManager } from "@/components/sheets-manager";

export default function SheetsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Noten</h1>
      <p className="text-muted-foreground">
        Notenbestand verwalten: Stück, Komponist, Genre, Schwierigkeit und
        Lagerort.
      </p>
      <SheetsManager />
    </div>
  );
}
