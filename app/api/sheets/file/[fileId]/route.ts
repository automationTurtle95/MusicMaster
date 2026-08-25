import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { readSheetFile } from "@/lib/storage";

// Lokaler, stateful Node-Server: Dateien liegen auf Platte (siehe lib/storage).
export const runtime = "nodejs";

// GET /api/sheets/file/[fileId] – Liefert das hochgeladene PDF aus dem
// persistenten Speicher aus. Auth erforderlich (gleiche Sichtbarkeit wie
// Katalog). fileId ist der gespeicherte Dateiname, z. B. "<uuid>.pdf".
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { fileId } = await params;
  // readSheetFile erwartet die interne Serve-Referenz; wir bauen sie aus der
  // Route zusammen (Path-Traversal ist ausgeschlossen, da fileId per Regex
  // nur "<uuid>.pdf" zulässt).
  const data = await readSheetFile(`/api/sheets/file/${fileId}`);
  if (!data) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileId}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
