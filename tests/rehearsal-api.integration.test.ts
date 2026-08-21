// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Auth wird für den Test auf eine ADMIN-Session gemockt, damit die
// RBAC-Gates (isManager) durchlässig sind. Die echte Prisma-Schicht und
// das migrierte SQLite-Schema bleiben aktiv -> echter Integrationstest.
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "test-user", role: "ADMIN", email: "test@musicmaster.app" },
  })),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/rehearsals/route";
import {
  DELETE,
  GET as GET_BY_ID,
  PATCH,
} from "@/app/api/rehearsals/[id]/route";
import {
  GET as GET_ATTENDANCE,
  PUT as PUT_ATTENDANCE,
} from "@/app/api/rehearsals/[id]/attendance/route";

const rehearsalPayload = {
  title: "Probe Donnerstag",
  startsAt: "2026-09-01T19:00:00.000Z",
  location: "Proberaum",
};

describe("Rehearsal + Attendance API integration", () => {
  const rehearsalIds: string[] = [];
  let memberA = "";
  let memberB = "";

  beforeAll(async () => {
    await prisma.$connect();
    const a = await prisma.member.create({
      data: { firstName: "Anwesend", lastName: "Ma", instrument: "Trompete" },
    });
    const b = await prisma.member.create({
      data: { firstName: "Abwesend", lastName: "Mb", instrument: "Flöte" },
    });
    memberA = a.id;
    memberB = b.id;
  });

  afterAll(async () => {
    if (rehearsalIds.length) {
      await prisma.rehearsal
        .deleteMany({ where: { id: { in: rehearsalIds } } })
        .catch(() => undefined);
    }
    await prisma.member
      .deleteMany({ where: { id: { in: [memberA, memberB] } } })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("legt eine Probe an, liest und aktualisiert sie", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/rehearsals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rehearsalPayload),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { rehearsal: { id: string } };
    expect(created.rehearsal.id).toBeTruthy();
    rehearsalIds.push(created.rehearsal.id);

    const listRes = await GET();
    const list = (await listRes.json()) as {
      rehearsals: { id: string }[];
    };
    expect(list.rehearsals.some((r) => r.id === created.rehearsal.id)).toBe(true);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/rehearsals/${created.rehearsal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "Großer Saal" }),
      }),
      { params: Promise.resolve({ id: created.rehearsal.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      rehearsal: { location: string };
    };
    expect(patched.rehearsal.location).toBe("Großer Saal");
  });

  it("erfasst Anwesenheit je Mitglied (Massen-Edit) und liest sie aus", async () => {
    const id = rehearsalIds[0];
    const putRes = await PUT_ATTENDANCE(
      new Request(`http://localhost/api/rehearsals/${id}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { memberId: memberA, status: "PRESENT", note: "pünktlich" },
            { memberId: memberB, status: "ABSENT" },
          ],
        }),
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(putRes.status).toBe(200);
    const saved = (await putRes.json()) as {
      attendance: { memberId: string; status: string; note: string | null }[];
    };
    expect(saved.attendance).toHaveLength(2);

    const getRes = await GET_ATTENDANCE(
      new Request(`http://localhost/api/rehearsals/${id}/attendance`),
      { params: Promise.resolve({ id }) }
    );
    const list = (await getRes.json()) as {
      attendance: { memberId: string; status: string }[];
    };
    const byMember = new Map(list.attendance.map((a) => [a.memberId, a.status]));
    expect(byMember.get(memberA)).toBe("PRESENT");
    expect(byMember.get(memberB)).toBe("ABSENT");
  });

  it("aktualisiert einen bestehenden Anwesenheitseintrag per Upsert", async () => {
    const id = rehearsalIds[0];
    // Erneuter PUT mit geändertem Status für memberA – darf keinen Duplikat-
    // Fehler erzeugen und muss den Status überschreiben.
    const putRes = await PUT_ATTENDANCE(
      new Request(`http://localhost/api/rehearsals/${id}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ memberId: memberA, status: "EXCUSED" }],
        }),
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(putRes.status).toBe(200);

    const getRes = await GET_ATTENDANCE(
      new Request(`http://localhost/api/rehearsals/${id}/attendance`),
      { params: Promise.resolve({ id }) }
    );
    const list = (await getRes.json()) as {
      attendance: { memberId: string; status: string }[];
    };
    expect(list.attendance).toHaveLength(2);
    expect(
      list.attendance.find((a) => a.memberId === memberA)?.status
    ).toBe("EXCUSED");
  });

  it("lehnt ungültigen Anwesenheitsstatus ab", async () => {
    const id = rehearsalIds[0];
    const putRes = await PUT_ATTENDANCE(
      new Request(`http://localhost/api/rehearsals/${id}/attendance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{ memberId: memberA, status: "Vielleicht" }],
        }),
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(putRes.status).toBe(400);
  });

  it("löscht die Probe (Anwesenheiten via Cascade mitgelöscht)", async () => {
    const id = rehearsalIds[0];
    const delRes = await DELETE(
      new Request(`http://localhost/api/rehearsals/${id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) }
    );
    expect(delRes.status).toBe(200);
    rehearsalIds.shift();

    const single = await GET_BY_ID(
      new Request(`http://localhost/api/rehearsals/${id}`),
      { params: Promise.resolve({ id }) }
    );
    expect(single.status).toBe(404);

    const att = await prisma.attendance.findMany({ where: { rehearsalId: id } });
    expect(att).toHaveLength(0);
  });
});
