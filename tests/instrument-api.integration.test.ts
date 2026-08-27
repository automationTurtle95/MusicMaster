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
import { GET, POST } from "@/app/api/instruments/route";
import {
  DELETE,
  GET as GET_BY_ID,
  PATCH,
} from "@/app/api/instruments/[id]/route";

describe("Instrument API integration (LUH-216 CRUD-Pfad)", () => {
  const instrumentIds: string[] = [];
  let memberId: string | null = null;

  beforeAll(async () => {
    await prisma.$connect();
    const member = await prisma.member.create({
      data: {
        firstName: "Leih",
        lastName: "Nehmer",
        instrument: "Trompete",
      },
    });
    memberId = member.id;
  });

  afterAll(async () => {
    if (instrumentIds.length) {
      await prisma.instrument
        .deleteMany({ where: { id: { in: instrumentIds } } })
        .catch(() => undefined);
    }
    if (memberId) {
      await prisma.member.delete({ where: { id: memberId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("legt an, liest, aktualisiert und löscht ein Instrument", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Klarinette",
          inventoryNumber: `INV-${Date.now()}`,
          condition: "Gut",
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { instrument: { id: string } };
    expect(created.instrument.id).toBeTruthy();
    instrumentIds.push(created.instrument.id);

    const listRes = await GET();
    const list = (await listRes.json()) as { instruments: { id: string }[] };
    expect(list.instruments.some((i) => i.id === created.instrument.id)).toBe(true);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/instruments/${created.instrument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition: "Neuwertig" }),
      }),
      { params: Promise.resolve({ id: created.instrument.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { instrument: { condition: string } };
    expect(patched.instrument.condition).toBe("Neuwertig");

    const delRes = await DELETE(
      new Request(`http://localhost/api/instruments/${created.instrument.id}`),
      { params: Promise.resolve({ id: created.instrument.id }) }
    );
    expect(delRes.status).toBe(200);
    instrumentIds.pop();
  });

  it("lehnt ungültiges Register ab (400)", async () => {
    const res = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Banjo",
          inventoryNumber: `INV-${Date.now()}-bad`,
          condition: "Gut",
        }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("verhindert doppelte Inventarnummern (409)", async () => {
    const inv = `INV-DUP-${Date.now()}`;
    const first = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "Flöte", inventoryNumber: inv, condition: "Gut" }),
      })
    );
    expect(first.status).toBe(201);
    const created = (await first.json()) as { instrument: { id: string } };
    instrumentIds.push(created.instrument.id);

    const second = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "Flöte", inventoryNumber: inv, condition: "Gut" }),
      })
    );
    expect(second.status).toBe(409);
  });

  it("verleiht ein Instrument an ein Mitglied und nimmt es zurück", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "Trompete",
          inventoryNumber: `INV-LOAN-${Date.now()}`,
          condition: "Gut",
          memberId: memberId,
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as {
      instrument: { id: string; memberId: string | null; member: { id: string } | null };
    };
    expect(created.instrument.memberId).toBe(memberId);
    expect(created.instrument.member?.id).toBe(memberId);
    instrumentIds.push(created.instrument.id);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/instruments/${created.instrument.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: null }),
      }),
      { params: Promise.resolve({ id: created.instrument.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      instrument: { memberId: string | null };
    };
    expect(patched.instrument.memberId).toBeNull();
  });
});
