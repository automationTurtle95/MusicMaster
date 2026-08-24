import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardKpi } from "@/lib/dashboard";

function KpiTile({
  label,
  value,
  delta,
  deltaPositive,
  sublabel,
  placeholder,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  sublabel: string;
  placeholder?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          {delta !== undefined && (
            <span
              className={cn(
                "text-sm font-medium tabular-nums",
                deltaPositive ? "text-[#4f7a52]" : "text-destructive"
              )}
            >
              {delta}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        {placeholder && (
          <span className="mt-2 inline-block rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Platzhalter
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiTiles({ kpi }: { kpi: DashboardKpi }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Aktive Mitglieder"
        value={String(kpi.activeMembers)}
        delta={`${kpi.memberDelta >= 0 ? "+" : ""}${kpi.memberDelta}`}
        deltaPositive={kpi.memberDelta >= 0}
        sublabel={`${kpi.newMembers} Neuzugänge, ${kpi.exitedMembers} Austritte`}
      />
      <KpiTile
        label="Ø Anwesenheit"
        value={`${kpi.attendanceRate.toFixed(1)} %`}
        delta={kpi.attendanceDeltaPlaceholder}
        deltaPositive
        sublabel="Ø letzte 5 Gesamtproben"
        placeholder
      />
      <KpiTile
        label="Offene Beiträge"
        value="—"
        sublabel="Beitragsmodell ausstehend"
        placeholder
      />
      <KpiTile
        label="Bis Jahreskonzert"
        value={kpi.daysToConcert !== null ? `${kpi.daysToConcert} Tage` : "—"}
        sublabel={
          kpi.concertDate && kpi.concertPlace
            ? `${kpi.concertDate} · ${kpi.concertPlace}`
            : "Termin folgt"
        }
        placeholder
      />
    </div>
  );
}
