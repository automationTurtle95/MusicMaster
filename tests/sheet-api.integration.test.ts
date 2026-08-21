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
import { GET, POST } from "@/app/api/sheets/route";
import {
  DELETE,
  GET as GET_BY_ID,
  PATCH,
} from "@/app/api/sheets/[id]/route";

const sample = {
  title: "Brass Festival",
  composer: "Müller",
  genre: "Blasmusik",
  difficulty: "MITTEL",
  storage: "Regal A3",
};

describe("SheetMusic API integration (kritischer CRUD-Pfad)", () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdIds.length) {
      await prisma.sheetMusic
        .deleteMany({ where: { id: { in: createdIds } } })
        .catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("legt an, liest, aktualisiert und löscht ein Notenstück", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sample),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { sheet: { id: string } };
    expect(created.sheet.id).toBeTruthy();
    createdIds.push(created.sheet.id);

    const listRes = await GET(new Request("http://localhost/api/sheets"));
    const list = (await listRes.json()) as { sheets: { id: string }[] };
    expect(list.sheets.some((s) => s.id === created.sheet.id)).toBe(true);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/sheets/${created.sheet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ difficulty: "SCHWER" }),
      }),
      { params: Promise.resolve({ id: created.sheet.id }) }
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { sheet: { difficulty: string } };
    expect(patched.sheet.difficulty).toBe("SCHWER");

    const delRes = await DELETE(
      new Request(`http://localhost/api/sheets/${created.sheet.id}`),
      { params: Promise.resolve({ id: created.sheet.id }) }
    );
    expect(delRes.status).toBe(200);
    createdIds.pop();
  });

  it("behält nicht übertragene Felder beim PATCH bei (kein Datenverlust)", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Bleibt",
          composer: "ComposerX",
          genre: "Jazz",
          storage: "Regal B1",
          notes: "wichtig",
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { sheet: { id: string } };
    createdIds.push(created.sheet.id);

    const patchRes = await PATCH(
      new Request(`http://localhost/api/sheets/${created.sheet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre: "Klassik" }),
      }),
      { params: Promise.resolve({ id: created.sheet.id }) }
    );
    expect(patchRes.status).toBe(200);

    const singleRes = await GET_BY_ID(
      new Request(`http://localhost/api/sheets/${created.sheet.id}`),
      { params: Promise.resolve({ id: created.sheet.id }) }
    );
    const fetched = (await singleRes.json()) as {
      sheet: {
        genre: string | null;
        composer: string | null;
        storage: string | null;
        notes: string | null;
      };
    };
    expect(fetched.sheet.genre).toBe("Klassik");
    expect(fetched.sheet.composer).toBe("ComposerX");
    expect(fetched.sheet.storage).toBe("Regal B1");
    expect(fetched.sheet.notes).toBe("wichtig");
  });

  it("findet Notenstücke über die Suche (Titel/Komponist/Genre)", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Suche Mich",
          composer: "Suchkomponist",
          genre: "Suchgenre",
        }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { sheet: { id: string } };
    createdIds.push(created.sheet.id);

    for (const q of ["mich", "SUCHKOMP", "genre"]) {
      const res = await GET(
        new Request(`http://localhost/api/sheets?q=${encodeURIComponent(q)}`)
      );
      const data = (await res.json()) as { sheets: { id: string }[] };
      expect(data.sheets.some((s) => s.id === created.sheet.id)).toBe(true);
    }
  });

  it("lehnt ungültige Schwierigkeit ab (Validierung)", async () => {
    const res = await POST(
      new Request("http://localhost/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "X", difficulty: "UNBEKANNT" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
