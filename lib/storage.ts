import { existsSync, mkdirSync } from "fs";
import { promises as fsp } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Persistenter Ablageort für hochgeladene Noten-PDFs. Über Env überschreibbar,
// damit der Pfad in Container-Deployments (siehe docker-compose.yml) auf ein
// gemountetes Volume zeigen kann.
export const SHEET_STORAGE_DIR =
  process.env.SHEET_STORAGE_DIR || path.join(process.cwd(), "storage", "sheets");

export function ensureSheetStorageDir(): string {
  if (!existsSync(SHEET_STORAGE_DIR)) {
    mkdirSync(SHEET_STORAGE_DIR, { recursive: true });
  }
  return SHEET_STORAGE_DIR;
}

// Interne Datei-Referenz (Token) ist unsere Serve-Route, z. B.
// "/api/sheets/file/<uuid>.pdf". Externe/manuell gepflegte Links enthalten
// "://" und werden nicht aus dem lokalen Speicher ausgeliefert.
const INTERNAL_PATH_RE = /^\/api\/sheets\/file\/([a-zA-Z0-9-]+\.pdf)$/i;

export function isInternalFileToken(fileUrl: string | null | undefined): boolean {
  if (!fileUrl || typeof fileUrl !== "string") return false;
  if (fileUrl.includes("://")) return false;
  return INTERNAL_PATH_RE.test(fileUrl);
}

// Liefert die gespeicherte Datei-ID (z. B. "<uuid>.pdf") aus der internen
// Serve-Route – oder null, wenn es keine interne Referenz ist.
export function serveFileIdFromUrl(
  fileUrl: string | null | undefined
): string | null {
  if (!fileUrl) return null;
  const m = INTERNAL_PATH_RE.exec(fileUrl);
  return m ? m[1] : null;
}

// Validiert eine rohe Datei-ID (aus dem Pfad-Parameter der Serve-Route) und
// gibt sie bei gültigem Format zurück, sonst null (Path-Traversal-Schutz).
export function safeServeFileId(fileId: string): string | null {
  return INTERNAL_PATH_RE.test(`/api/sheets/file/${fileId}`) ? fileId : null;
}

// Liest die hochgeladene PDF-Datei aus dem persistenten Speicher. Bei nicht
// internen Links oder fehlender Datei wird null geliefert.
export async function readSheetFile(
  fileUrl: string | null | undefined
): Promise<Buffer | null> {
  const fileId = serveFileIdFromUrl(fileUrl);
  if (!fileId) return null;
  const full = path.join(SHEET_STORAGE_DIR, fileId);
  try {
    const info = await fsp.stat(full);
    if (!info.isFile()) return null;
    return await fsp.readFile(full);
  } catch {
    return null;
  }
}

// Speichert einen Buffer persistent und liefert die interne Serve-Referenz
// (fileUrl) sowie den Dateinamen (storedName) zurück.
export async function saveSheetFile(
  buffer: Buffer,
  ext: string
): Promise<{ storedName: string; fileUrl: string }> {
  const dir = ensureSheetStorageDir();
  const safeExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const storedName = `${randomUUID()}.${safeExt}`;
  await fsp.writeFile(path.join(dir, storedName), buffer);
  return { storedName, fileUrl: `/api/sheets/file/${storedName}` };
}

// Löscht die zugehörige Datei. `ref` darf die volle Serve-URL ODER nur die
// Datei-ID sein. Nicht-interne Werte (externe URLs) sind ein No-Op.
export async function deleteSheetFile(ref: string): Promise<void> {
  const fileId =
    serveFileIdFromUrl(ref) ??
    (INTERNAL_PATH_RE.test(`/api/sheets/file/${ref}`) ? ref : null);
  if (!fileId) return;
  const full = path.join(SHEET_STORAGE_DIR, fileId);
  await fsp.unlink(full).catch(() => undefined);
}
