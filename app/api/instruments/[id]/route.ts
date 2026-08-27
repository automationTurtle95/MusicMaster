import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { instrumentUpdateSchema } from "@/lib/validations/instrument";

const instrumentInclude = {
  member: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

// GET /api/instruments/[id] – Einzelnes Instrument
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const instrument = await prisma.instrument.findUnique({
    where: { id },
    include: instrumentInclude,
  });
  if (!instrument) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ instrument });
}

// PATCH /api/instruments/[id] – Aktualisieren (partiell, validiert via Zod)
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
  const normalized = {
    ...body,
    memberId: body?.memberId === "" ? null : body?.memberId,
  };
  const parsed = instrumentUpdateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.instrument.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const data = { ...parsed.data };
  if (data.memberId === undefined) {
    delete data.memberId; // nicht übertragen -> unverändert lassen
  } else {
    data.memberId = data.memberId ?? null;
  }

  try {
    const instrument = await prisma.instrument.update({
      where: { id },
      data,
      include: instrumentInclude,
    });
    return NextResponse.json({ instrument });
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Inventarnummer ist bereits vergeben" },
        { status: 409 }
      );
    }
    throw err;
  }
}

// DELETE /api/instruments/[id] – Entfernen
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.instrument.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.instrument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
