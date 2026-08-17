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
import { GET, POST } from "@/app/api/members/route";
import {
  DELETE,
  GET as GET_BY_ID,
  PATCH,
} from "@/app/api/members/[id]/route";

const sample = {
  firstName: "Test",
  lastName: "User",
  instrument: "Trompete",
  email: `testuser+${Date.now()}@example.com`,
};

describe("Member API integration (kritischer CRUD-Pfad)", () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.member
        .deleteMany({ where: { id: { in: createdIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("legt an, liest, aktualisiert und löscht ein Mitglied", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { member: { id: string } };
    expect(created.member.id).toBeTruthy();
    createdIds.push(created.member.id);

    const listRes = await GET();
    const list = (await listRes.json()) as { members: { id: string }[] };
    expect(list.members.some((m) => m.id === created.member.id)).toBe(true);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/members/${created.member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: created.member.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { member: { active: boolean } };
    expect(patched.member.active).toBe(false);

    const delRes = await DELETE(
      new Request(`http://localhost/api/members/${created.member.id}`),
      { params: Promise.resolve({ id: created.member.id }) }
    );
    expect(delRes.status).toBe(200);
    createdIds.pop();
  });

  it("behält nicht übertragene Felder beim PATCH bei (kein Datenverlust)", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Bleibt",
          lastName: "Vorhanden",
          instrument: "Horn",
          phone: "0123",
          notes: "wichtig",
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { member: { id: string } };
    createdIds.push(created.member.id);

    // Nur ein Feld ändern – die übrigen dürfen nicht zu Leerstrings werden.
    const patchRes = await PATCH(
      new Request(`http://localhost/api/members/${created.member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: created.member.id }) }
    );
    expect(patchRes.status).toBe(200);

    const singleRes = await GET_BY_ID(
      new Request(`http://localhost/api/members/${created.member.id}`),
      { params: Promise.resolve({ id: created.member.id }) }
    );
    const fetched = (await singleRes.json()) as {
      member: { active: boolean; phone: string | null; notes: string | null };
    };
    expect(fetched.member.active).toBe(false);
    expect(fetched.member.phone).toBe("0123");
    expect(fetched.member.notes).toBe("wichtig");
  });

  it("erlaubt mehrere Mitglieder ohne E-Mail (Unique-Constraint)", async () => {
    const a = await POST(
      new Request("http://localhost/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Ohne",
          lastName: "Mail1",
          instrument: "Flöte",
          email: "",
        }),
      })
    );
    expect(a.status).toBe(201);
    createdIds.push(((await a.json()) as { member: { id: string } }).member.id);

    const b = await POST(
      new Request("http://localhost/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Ohne",
          lastName: "Mail2",
          instrument: "Flöte",
          email: "",
        }),
      })
    );
    expect(b.status).toBe(201);
    createdIds.push(((await b.json()) as { member: { id: string } }).member.id);
  });
});
