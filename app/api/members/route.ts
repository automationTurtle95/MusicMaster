import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isManager } from "@/lib/authz";
import { memberCreateSchema } from "@/lib/validations/member";

// GET /api/members – Liste (geschützt durch Middleware).
// Voller Datensatz, damit der Edit-Dialog ohne erneuten Fetch alle Felder
// (Adresse, Telefon, Beitritt, Notizen) korrekt vorbelegen kann – sonst
// würden beim PATCH nicht gelieferte Felder zu Leerstrings überschrieben.
export async function GET() {
  const members = await prisma.member.findMany({
    orderBy: { lastName: "asc" },
  });
  return NextResponse.json({ members });
}

// POST /api/members – Neues Mitglied anlegen (validiert via Zod)
export async function POST(request: Request) {
  const session = await auth();
  if (!isManager(session?.user?.role)) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = memberCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Leere E-Mail als NULL speichern, damit die Unique-Constraint mehrfach
  // für Mitglieder ohne E-Mail erlaubt ist (SQLite erlaubt doppelte NULL, nicht "").
  const data = {
    ...parsed.data,
    email: parsed.data.email === "" ? null : parsed.data.email,
  };

  const member = await prisma.member.create({ data });
  return NextResponse.json({ member }, { status: 201 });
}
