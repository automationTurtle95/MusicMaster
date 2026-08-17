import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { memberCreateSchema } from "@/lib/validations/member";

// GET /api/members – Liste (geschützt durch Middleware)
export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { lastName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      instrument: true,
      active: true,
    },
  });
  return NextResponse.json({ members });
}

// POST /api/members – Neues Mitglied anlegen (validiert via Zod)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = memberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const member = await prisma.member.create({ data: parsed.data });
  return NextResponse.json({ member }, { status: 201 });
}
