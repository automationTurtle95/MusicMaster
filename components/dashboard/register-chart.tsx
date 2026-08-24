import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RegisterStat } from "@/lib/dashboard";

function barColor(ratio: number): string {
  if (ratio >= 1) return "#4f7a52";
  if (ratio >= 0.6) return "#b06a17";
  return "#a13b2f";
}

export function RegisterChart({ registers }: { registers: RegisterStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Besetzung nach Register</CardTitle>
        <CardDescription>Soll / Ist pro Instrumentengruppe</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {registers.map((reg) => {
          const ratio = reg.soll > 0 ? reg.ist / reg.soll : 0;
          const pct = Math.min(100, Math.round(ratio * 100));
          return (
            <div key={reg.name} className="flex items-center gap-3">
              <span className="w-32 shrink-0 truncate text-sm">{reg.name}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: barColor(ratio) }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                {reg.ist}/{reg.soll}
              </span>
            </div>
          );
        })}
        <p className="pt-1 text-xs text-muted-foreground">
          Ist-Werte aus dem Mitgliederkonto (Feld „Instrument“). Soll-Werte sind
          Platzhalter – das Register-/Instrumentenmodell ist in Arbeit (LUH-125).
        </p>
      </CardContent>
    </Card>
  );
}
