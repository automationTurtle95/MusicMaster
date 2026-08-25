import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { isManager } from "@/lib/authz";
import { saveSheetFile } from "@/lib/storage";

// Lokaler, stateful Node-Server (kein Serverless) – Dateiablage auf Platte ist
// damit architektonisch konsistent (siehe LUH-116 / Docker-Entscheidung).
export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

// POST /api/sheets/upload – Nimmt eine einzelne PDF-Datei entgegen
// (multipart/form-data, Feldname "file"), validiert Typ & Größe und legt
// sie persistent ab. Liefert { storedName, fileUrl } zurück; fileUrl wird
// automatisch am Notenstück verknüpft. Nur Manager.
export async function POST(request: Request) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (
    !file ||
    typeof file === "string" ||
    typeof (file as Blob).arrayBuffer !== "function"
  ) {
    return NextResponse.json(
      { error: "Keine Datei übermittelt" },
      { status: 400 }
    );
  }

  const blob = file as Blob;
  if (blob.size === 0) {
    return NextResponse.json({ error: "Leere Datei" }, { status: 400 });
  }
  if (blob.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Datei zu groß (max. 20 MB)" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  // Deklarierter MIME-Type muss PDF sein (sonst 415) …
  const declaredType = (file as File).type ?? "";
  if (declaredType && declaredType !== "application/pdf") {
    return NextResponse.json(
      { error: "Nur PDF-Dateien erlaubt" },
      { status: 415 }
    );
  }
  // … und die Magic-Bytes müssen stimmen (sonst 422, kein Masking als PDF).
  const isPdfMagic = buffer.subarray(0, 5).toString("latin1") === "%PDF-";
  if (!isPdfMagic) {
    return NextResponse.json(
      { error: "Datei ist kein gültiges PDF" },
      { status: 422 }
    );
  }

  const result = await saveSheetFile(buffer, "pdf");
  return NextResponse.json(result, { status: 201 });
}
