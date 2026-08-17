import { MembersManager } from "@/components/members-manager";

export default function MembersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mitglieder</h1>
        <p className="text-muted-foreground">
          Kontaktdaten, Instrument und Aktivstatus verwalten.
        </p>
      </div>
      <MembersManager />
    </div>
  );
}
