import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { sheetUpdateSchema } from "@/lib/validations/sheet";

// GET /api/sheets/[id] – Einzelnes Notenstück.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sheet = await prisma.sheetMusic.findUnique({ where: { id } });
  if (!sheet) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ sheet });
}

// PATCH /api/sheets/[id] – Aktualisieren (partiell, validiert via Zod).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = sheetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.sheetMusic.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  // Leeres fileUrl als NULL speichern (siehe POST). Nur übertragene Felder
  // werden überschrieben – keine Datenverluste bei partiellen Updates.
  const patch = parsed.data;
  const data = {
    ...patch,
    fileUrl: patch.fileUrl === "" ? null : patch.fileUrl,
  };

  const sheet = await prisma.sheetMusic.update({
    where: { id },
    data,
  });
  return NextResponse.json({ sheet });
}

// DELETE /api/sheets/[id] – Entfernen.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.sheetMusic.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.sheetMusic.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
