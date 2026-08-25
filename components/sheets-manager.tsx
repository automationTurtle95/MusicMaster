"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { sheetDifficulty } from "@/lib/validations/enums";

type Sheet = {
  id: string;
  title: string;
  composer: string | null;
  genre: string | null;
  difficulty: string | null;
  storage: string | null;
  fileUrl: string | null;
  notes: string | null;
};

type SheetInput = {
  title: string;
  composer: string;
  genre: string;
  difficulty: string;
  storage: string;
  fileUrl: string;
  notes: string;
};

const DIFFICULTIES = sheetDifficulty.options;

const EMPTY: SheetInput = {
  title: "",
  composer: "",
  genre: "",
  difficulty: "",
  storage: "",
  fileUrl: "",
  notes: "",
};

export function SheetsManager() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Sheet | null>(null);
  const [form, setForm] = useState<SheetInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Upload-Zustand für echtes PDF-Upload (statt nur URL-Copy-Paste).
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedToken, setUploadedToken] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  async function load(q = "") {
    setLoading(true);
    const res = await fetch(q ? `/api/sheets?q=${encodeURIComponent(q)}` : "/api/sheets");
    if (res.ok) {
      const data = await res.json();
      setSheets(data.sheets ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setUploadedToken(null);
    setUploadedName(null);
  }

  function startEdit(s: Sheet) {
    setEditing(s);
    setForm({
      title: s.title,
      composer: s.composer ?? "",
      genre: s.genre ?? "",
      difficulty: s.difficulty ?? "",
      storage: s.storage ?? "",
      fileUrl: s.fileUrl ?? "",
      notes: s.notes ?? "",
    });
    setError(null);
    // Bereits hochgeladene interne Datei übernehmen (kein "://" = internes Token).
    const isInternal = !!s.fileUrl && !s.fileUrl.includes("://");
    setUploadedToken(isInternal ? s.fileUrl : null);
    setUploadedName(
      isInternal ? (s.fileUrl ?? "").split("/").pop() ?? s.fileUrl : null
    );
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
  }

  function clearUpload() {
    setUploadedToken(null);
    setUploadedName(null);
    setUploadError(null);
    setForm((prev) => ({ ...prev, fileUrl: "" }));
  }

  function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/sheets/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          setUploadedToken(data.fileUrl);
          setUploadedName(file.name);
        } catch {
          setUploadError("Unerwartete Antwort vom Server");
        }
      } else {
        let msg = "Upload fehlgeschlagen";
        try {
          msg = JSON.parse(xhr.responseText)?.error ?? msg;
        } catch {
          /* ignore */
        }
        setUploadError(msg);
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      setUploadError("Netzwerkfehler beim Upload");
    };
    xhr.send(fd);
  }

  function update(field: keyof SheetInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = { ...form };
    // Hochgeladene Datei hat Vorrang vor manuellem URL-Feld.
    payload.fileUrl = uploadedToken ?? form.fileUrl ?? "";
    if (!payload.fileUrl) payload.fileUrl = "";
    if (!payload.difficulty) delete payload.difficulty;

    const res = editing
      ? await fetch(`/api/sheets/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (res.ok) {
      startCreate();
      load(query);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function remove(s: Sheet) {
    if (!confirm(`Notenstück "${s.title}" löschen?`)) return;
    const res = await fetch(`/api/sheets/${s.id}`, { method: "DELETE" });
    if (res.ok) load(query);
    else setError("Löschen fehlgeschlagen");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>Notenkatalog ({sheets.length})</span>
          </CardTitle>
          <div className="pt-2">
            <Input
              placeholder="Suche: Titel, Komponist, Genre…"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                load(v);
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : sheets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {query ? "Keine Treffer." : "Noch keine Noten erfasst."}
            </p>
          ) : (
            <ul className="divide-y">
              {sheets.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium">
                      {s.title}{" "}
                      {s.difficulty && (
                        <span className="text-xs text-muted-foreground">
                          ({s.difficulty})
                        </span>
                      )}
                    </p>
                     <p className="text-xs text-muted-foreground">
                       {s.composer ? `${s.composer} · ` : ""}
                       {s.genre ?? "ohne Genre"}
                       {s.storage ? ` · Lager: ${s.storage}` : ""}
                     </p>
                     {s.fileUrl && (
                       <a
                         href={s.fileUrl}
                         target="_blank"
                         rel="noreferrer"
                         className="text-xs text-blue-600 underline"
                       >
                         Noten-PDF öffnen
                       </a>
                     )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(s)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(s)}
                    >
                      Löschen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? "Notenstück bearbeiten" : "Neues Notenstück"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <Input
              placeholder="Titel *"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Komponist"
                value={form.composer}
                onChange={(e) => update("composer", e.target.value)}
              />
              <Input
                placeholder="Genre"
                value={form.genre}
                onChange={(e) => update("genre", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.difficulty}
                onChange={(e) => update("difficulty", e.target.value)}
              >
                <option value="">Schwierigkeit –</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <Input
                placeholder="Lagerort (z. B. Regal A3)"
                value={form.storage}
                onChange={(e) => update("storage", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Noten-PDF (Upload)</label>
              <input
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadFile(f);
                }}
                className="block w-full text-sm"
              />
              {uploading && (
                <p className="text-xs text-muted-foreground">
                  Upload… {uploadProgress}%
                </p>
              )}
              {uploadError && (
                <p className="text-sm text-destructive">{uploadError}</p>
              )}
              {uploadedName && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Hochgeladen: {uploadedName}</span>
                  <button
                    type="button"
                    onClick={clearUpload}
                    className="underline"
                  >
                    entfernen
                  </button>
                </p>
              )}
            </div>
            <Input
              placeholder="Externe Datei-URL (optional, statt Upload)"
              value={form.fileUrl}
              onChange={(e) => update("fileUrl", e.target.value)}
            />
            <textarea
              placeholder="Notizen"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Speichern…" : editing ? "Speichern" : "Anlegen"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={startCreate}>
                  Abbrechen
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
