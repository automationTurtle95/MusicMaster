import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { rehearsalCreateSchema } from "@/lib/validations/rehearsal";

// GET /api/rehearsals – Liste (chronologisch aufsteigend).
export async function GET() {
  const rehearsals = await prisma.rehearsal.findMany({
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { attendances: true } } },
  });
  return NextResponse.json({ rehearsals });
}

// POST /api/rehearsals – Neue Probe anlegen (validiert via Zod).
export async function POST(request: Request) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = rehearsalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const rehearsal = await prisma.rehearsal.create({ data: parsed.data });
  return NextResponse.json({ rehearsal }, { status: 201 });
}
