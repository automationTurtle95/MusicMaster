import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { rehearsalUpdateSchema } from "@/lib/validations/rehearsal";

// GET /api/rehearsals/[id] – Einzelne Probe inkl. Anwesenheiten.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const rehearsal = await prisma.rehearsal.findUnique({
    where: { id },
    include: { attendances: true },
  });
  if (!rehearsal) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ rehearsal });
}

// PATCH /api/rehearsals/[id] – Probe aktualisieren (partiell).
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
  const parsed = rehearsalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.rehearsal.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const rehearsal = await prisma.rehearsal.update({
    where: { id },
    data: parsed.data,
  });
  return NextResponse.json({ rehearsal });
}

// DELETE /api/rehearsals/[id] – Probe entfernen (Anwesenheiten via Cascade).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.rehearsal.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.rehearsal.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
