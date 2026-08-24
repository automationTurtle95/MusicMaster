import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { eventCreateSchema } from "@/lib/validations/event";

const eventInclude = {
  eventMembers: {
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, instrument: true },
      },
    },
  },
} as const;

// GET /api/events – Liste (chronologisch), inkl. Besetzung.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const events = await prisma.event.findMany({
    orderBy: { startsAt: "asc" },
    include: eventInclude,
  });
  return NextResponse.json({ events });
}

// POST /api/events – Neuen Auftritt anlegen (optional mit Besetzung).
export async function POST(request: Request) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = eventCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { members, ...eventData } = parsed.data;

  const event = await prisma.event.create({
    data: {
      ...eventData,
      eventMembers: members?.length
        ? {
            create: members.map((m) => ({
              memberId: m.memberId,
              role: m.role ?? null,
            })),
          }
        : undefined,
    },
    include: eventInclude,
  });

  return NextResponse.json({ event }, { status: 201 });
}
