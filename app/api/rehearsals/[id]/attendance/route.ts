import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { attendanceBulkSchema } from "@/lib/validations/attendance";

// GET /api/rehearsals/[id]/attendance – Anwesenheitsliste der Probe.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const attendance = await prisma.attendance.findMany({
    where: { rehearsalId: id },
    include: { member: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { member: { lastName: "asc" } },
  });
  return NextResponse.json({ attendance });
}

// PUT /api/rehearsals/[id]/attendance – Massen-Erfassung je Probe.
// Jeder Eintrag wird per Upsert (Unique rehearsalId+memberId) angelegt oder
// aktualisiert, damit derselbe Aufruf sowohl Erstanlage als auch Korrektur
// abdeckt. Nicht genannte Mitglieder bleiben unverändert.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id } = await params;
  const rehearsal = await prisma.rehearsal.findUnique({ where: { id } });
  if (!rehearsal) {
    return NextResponse.json({ error: "Probe nicht gefunden" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = attendanceBulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const items = parsed.data.items;
  const result = await prisma.$transaction(
    items.map((item) =>
      prisma.attendance.upsert({
        where: {
          rehearsalId_memberId: { rehearsalId: id, memberId: item.memberId },
        },
        create: {
          rehearsalId: id,
          memberId: item.memberId,
          status: item.status,
          note: item.note ?? null,
        },
        update: { status: item.status, note: item.note ?? null },
      })
    )
  );

  return NextResponse.json({ attendance: result });
}
