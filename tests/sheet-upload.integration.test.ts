// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Auth wird für den Test auf eine ADMIN-Session gemockt; die echte Prisma-
// Schicht und das migrierte SQLite-Schema bleiben aktiv -> echter
// Integrationstest des Upload-/Serve-/Cleanup-Pfads (LUH-118).
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "test-user", role: "ADMIN", email: "test@musicmaster.app" },
  })),
  handlers: {},
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { POST as uploadPOST } from "@/app/api/sheets/upload/route";
import { GET as GET_FILE } from "@/app/api/sheets/file/[fileId]/route";
import { deleteSheetFile } from "@/lib/storage";

function makePdf(): Uint8Array {
  return new TextEncoder().encode(
    "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
  );
}

function uploadReq(fd: FormData): Request {
  return new Request("http://localhost/api/sheets/upload", {
    method: "POST",
    body: fd,
  });
}

function pdfForm(bytes: Uint8Array, type = "application/pdf"): FormData {
  const fd = new FormData();
  fd.append(
    "file",
    new File([bytes as unknown as BlobPart], "note.pdf", { type })
  );
  return fd;
}

describe("SheetMusic file upload (LUH-118)", () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("uploads a PDF, serves it back and then removes it", async () => {
    const pdf = makePdf();
    const up = await uploadPOST(uploadReq(pdfForm(pdf)));
    expect(up.status).toBe(201);
    const body = (await up.json()) as { storedName: string; fileUrl: string };
    expect(body.storedName).toMatch(/^[a-zA-Z0-9-]+\.pdf$/i);
    expect(body.fileUrl).toBe(`/api/sheets/file/${body.storedName}`);

    const serve = await GET_FILE(
      new Request(`http://localhost/api/sheets/file/${body.storedName}`),
      { params: Promise.resolve({ fileId: body.storedName }) }
    );
    expect(serve.status).toBe(200);
    expect(serve.headers.get("Content-Type")).toBe("application/pdf");
    const out = Buffer.from(new Uint8Array(await serve.arrayBuffer()));
    expect(out.toString("latin1")).toBe(Buffer.from(pdf).toString("latin1"));

    await deleteSheetFile(body.fileUrl);
    const after = await GET_FILE(
      new Request(`http://localhost/api/sheets/file/${body.storedName}`),
      { params: Promise.resolve({ fileId: body.storedName }) }
    );
    expect(after.status).toBe(404);
  });

  it("rejects non-PDF uploads", async () => {
    const fd = new FormData();
    fd.append(
      "file",
      new File(
        [new TextEncoder().encode("hi") as unknown as BlobPart],
        "x.txt",
        { type: "text/plain" }
      )
    );
    expect((await uploadPOST(uploadReq(fd))).status).toBe(415);
  });

  it("rejects files without PDF magic bytes", async () => {
    expect(
      (await uploadPOST(uploadReq(pdfForm(new TextEncoder().encode("not a pdf")))))
        .status
    ).toBe(422);
  });

  it("rejects uploads from non-managers", async () => {
    const { auth } = await import("@/lib/auth");
    vi.mocked(auth).mockResolvedValueOnce({
      user: { id: "u", role: "MEMBER", email: "m@x.de" },
    } as never);

    expect((await uploadPOST(uploadReq(pdfForm(makePdf())))).status).toBe(403);
  });
});
