import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readSheetFile, serveFileIdFromUrl } from "@/lib/storage";

// GET /api/sheets/[id]/file – Löst das fileUrl eines Notenstücks auf
// und liefert die verknüpfte PDF-Datei aus. Externe Links werden per
// 302 umgeleitet; interne Token werden aus dem persistenten Speicher
// ausgeliefert. Pfad-Traversal ist ausgeschlossen.
// Jeder angemeldete Nutzer darf die Datei abrufen.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const sheet = await prisma.sheetMusic.findUnique({ where: { id } });
  if (!sheet) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const fileUrl = sheet.fileUrl;
  if (!fileUrl) {
    return NextResponse.json({ error: "Keine Datei verknüpft" }, { status: 404 });
  }

  // Externe Links werden per 302 umgeleitet.
  if (fileUrl.includes("://")) {
    return NextResponse.redirect(fileUrl, 302);
  }

  // Interne Token aus dem persistenten Speicher ausliefern.
  const data = await readSheetFile(fileUrl);
  if (!data) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const fileId = serveFileIdFromUrl(fileUrl);
  return new NextResponse(data, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileId}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
