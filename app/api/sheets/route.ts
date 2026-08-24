import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { sheetCreateSchema } from "@/lib/validations/sheet";

// GET /api/sheets – Katalog (optional Suche nach Titel/Komponist/Genre via ?q=).
// Voller Datensatz, damit der Detail-/Edit-Dialog ohne erneuten Fetch alle
// Felder korrekt vorbelegen kann (kein Überschreiben mit Leerstrings beim PATCH).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  const sheets = await prisma.sheetMusic.findMany({
    orderBy: { title: "asc" },
  });

  if (q) {
    const needle = q.toLowerCase();
    const filtered = sheets.filter(
      (s) =>
        s.title.toLowerCase().includes(needle) ||
        (s.composer?.toLowerCase().includes(needle) ?? false) ||
        (s.genre?.toLowerCase().includes(needle) ?? false)
    );
    return NextResponse.json({ sheets: filtered });
  }

  return NextResponse.json({ sheets });
}

// POST /api/sheets – Neues Notenstück anlegen (validiert via Zod).
export async function POST(request: Request) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sheetCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Leeres fileUrl als NULL speichern (keine leere Zeichenkette in DB).
  const data = {
    ...parsed.data,
    fileUrl: parsed.data.fileUrl === "" ? null : parsed.data.fileUrl,
  };

  const sheet = await prisma.sheetMusic.create({ data });
  return NextResponse.json({ sheet }, { status: 201 });
}
