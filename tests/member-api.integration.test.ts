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
  let createdId: string | null = null;

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdId) {
      await prisma.member
        .deleteMany({ where: { email: sample.email } })
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
    createdId = created.member.id;

    const listRes = await GET();
    const list = (await listRes.json()) as { members: { id: string }[] };
    expect(list.members.some((m) => m.id === createdId)).toBe(true);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/members/${createdId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
      { params: Promise.resolve({ id: createdId }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { member: { active: boolean } };
    expect(patched.member.active).toBe(false);

    const delRes = await DELETE(
      new Request(`http://localhost/api/members/${createdId}`),
      { params: Promise.resolve({ id: createdId }) }
    );
    expect(delRes.status).toBe(200);
    createdId = null;
  });
});
