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
import { GET, POST } from "@/app/api/events/route";
import {
  DELETE,
  GET as GET_BY_ID,
  PATCH,
} from "@/app/api/events/[id]/route";

const member = {
  firstName: "Cast",
  lastName: "Member",
  instrument: "Trompete",
};

describe("Event API integration (kritischer CRUD-Pfad + Besetzung)", () => {
  const eventIds: string[] = [];
  let castMemberId = "";

  beforeAll(async () => {
    await prisma.$connect();
    const created = await prisma.member.create({ data: member });
    castMemberId = created.id;
  });

  afterAll(async () => {
    if (eventIds.length) {
      await prisma.event
        .deleteMany({ where: { id: { in: eventIds } } })
        .catch(() => undefined);
    }
    await prisma.member
      .deleteMany({
        where: { firstName: member.firstName, lastName: member.lastName },
      })
      .catch(() => undefined);
    await prisma.$disconnect();
  });

  it("legt Auftritt mit Besetzung an, liest und aktualisiert", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Sommerkonzert",
          startsAt: "2026-09-01T19:30",
          location: "Marktplatz",
          members: [{ memberId: castMemberId, role: "Solist" }],
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as {
      event: { id: string; eventMembers: { memberId: string; role: string }[] };
    };
    expect(created.event.id).toBeTruthy();
    expect(created.event.eventMembers).toHaveLength(1);
    expect(created.event.eventMembers[0].role).toBe("Solist");
    eventIds.push(created.event.id);

    const listRes = await GET();
    const list = (await listRes.json()) as { events: { id: string }[] };
    expect(list.events.some((e) => e.id === created.event.id)).toBe(true);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/events/${created.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: "Stadthalle" }),
      }),
      { params: Promise.resolve({ id: created.event.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      event: { location: string };
    };
    expect(patched.event.location).toBe("Stadthalle");

    const singleRes = await GET_BY_ID(
      new Request(`http://localhost/api/events/${created.event.id}`),
      { params: Promise.resolve({ id: created.event.id }) }
    );
    const fetched = (await singleRes.json()) as {
      event: { eventMembers: { role: string | null }[] };
    };
    // Besetzung bleibt erhalten, wenn `members` nicht im Payload ist.
    expect(fetched.event.eventMembers[0].role).toBe("Solist");
  });

  it("ersetzt die Besetzung bei PATCH mit members", async () => {
    const createRes = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Weihnachtskonzert",
          startsAt: "2026-12-20T18:00",
          location: "Kirche",
          members: [{ memberId: castMemberId, role: "Begleitung" }],
        }),
      })
    );
    const created = (await createRes.json()) as {
      event: { id: string };
    };
    eventIds.push(created.event.id);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/events/${created.event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members: [] }),
      }),
      { params: Promise.resolve({ id: created.event.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as {
      event: { eventMembers: unknown[] };
    };
    expect(patched.event.eventMembers).toHaveLength(0);
  });

  it("lehnt ungültige Eingaben ab (Validierung)", async () => {
    const res = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", location: "" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("löscht einen Auftritt (kaskadiert Besetzung)", async () => {
    const createRes = await POST(
      new Request("http://localhost/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Zu Löschen",
          startsAt: "2026-10-10T10:00",
          location: "Saal",
          members: [{ memberId: castMemberId }],
        }),
      })
    );
    const created = (await createRes.json()) as { event: { id: string } };
    eventIds.push(created.event.id);

    const delRes = await DELETE(
      new Request(`http://localhost/api/events/${created.event.id}`),
      { params: Promise.resolve({ id: created.event.id }) }
    );
    expect(delRes.status).toBe(200);
    eventIds.pop();

    const orphan = await prisma.eventMember.findMany({
      where: { eventId: created.event.id },
    });
    expect(orphan).toHaveLength(0);
  });
});
