import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { instrumentCreateSchema } from "@/lib/validations/instrument";

const instrumentInclude = {
  member: {
    select: { id: true, firstName: true, lastName: true },
  },
} as const;

// GET /api/instruments – Liste (auth-geprüft + Middleware)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }
  const instruments = await prisma.instrument.findMany({
    orderBy: { inventoryNumber: "asc" },
    include: instrumentInclude,
  });
  return NextResponse.json({ instruments });
}

// POST /api/instruments – Neues Instrument anlegen (validiert via Zod)
export async function POST(request: Request) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const normalized = {
    ...body,
    memberId: body?.memberId === "" ? null : body?.memberId,
  };
  const parsed = instrumentCreateSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = {
    ...parsed.data,
    memberId: parsed.data.memberId ?? null,
  };

  try {
    const instrument = await prisma.instrument.create({
      data,
      include: instrumentInclude,
    });
    return NextResponse.json({ instrument }, { status: 201 });
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
