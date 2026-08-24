"use client";

import { Button } from "@/components/ui/button";

export function ExportButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      Exportieren
    </Button>
  );
}
