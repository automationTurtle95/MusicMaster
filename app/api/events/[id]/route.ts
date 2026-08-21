import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { eventUpdateSchema } from "@/lib/validations/event";

const eventInclude = {
  eventMembers: {
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, instrument: true },
      },
    },
  },
} as const;

// GET /api/events/[id] – Einzelner Auftritt inkl. Besetzung.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    include: eventInclude,
  });
  if (!event) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ event });
}

// PATCH /api/events/[id] – Aktualisieren; `members` ersetzt die Besetzung.
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
  const parsed = eventUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  const { members, ...eventData } = parsed.data;

  // Besetzung wird nur dann angefasst, wenn sie im Payload enthalten ist.
  const event = await prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { id },
      data: eventData,
    });

    if (members !== undefined) {
      await tx.eventMember.deleteMany({ where: { eventId: id } });
      for (const m of members) {
        await tx.eventMember.create({
          data: { eventId: id, memberId: m.memberId, role: m.role ?? null },
        });
      }
    }

    return updated;
  });

  const result = await prisma.event.findUnique({
    where: { id: event.id },
    include: eventInclude,
  });

  return NextResponse.json({ event: result });
}

// DELETE /api/events/[id] – Entfernen (Besetzung kaskadiert).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
