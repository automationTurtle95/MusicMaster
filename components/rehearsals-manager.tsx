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

type Rehearsal = {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  notes: string | null;
  _count?: { attendances: number };
};

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  instrument: string;
};

type AttendanceRow = {
  id: string | null;
  memberId: string;
  status: "PRESENT" | "EXCUSED" | "ABSENT";
  note: string;
};

const STATUSES: AttendanceRow["status"][] = ["PRESENT", "EXCUSED", "ABSENT"];

const STATUS_LABEL: Record<AttendanceRow["status"], string> = {
  PRESENT: "Da",
  EXCUSED: "Entschuldigt",
  ABSENT: "Fehlt",
};

type RehearsalInput = {
  title: string;
  startsAt: string;
  location: string;
  notes: string;
};

const EMPTY: RehearsalInput = {
  title: "",
  startsAt: "",
  location: "",
  notes: "",
};

// ISO-String -> Wert für <input type="datetime-local"> (YYYY-MM-DDTHH:mm, lokal).
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function RehearsalsManager() {
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Rehearsal | null>(null);
  const [form, setForm] = useState<RehearsalInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Rehearsal | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attSaving, setAttSaving] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);
  const [attMsg, setAttMsg] = useState<string | null>(null);

  async function loadRehearsals() {
    setLoading(true);
    const res = await fetch("/api/rehearsals");
    if (res.ok) {
      const data = await res.json();
      setRehearsals(data.rehearsals ?? []);
    }
    setLoading(false);
  }

  async function loadMembers() {
    const res = await fetch("/api/members");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
    }
  }

  useEffect(() => {
    loadRehearsals();
    loadMembers();
  }, []);

  function startCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
  }

  function startEdit(r: Rehearsal) {
    setEditing(r);
    setForm({
      title: r.title,
      startsAt: toLocalInput(r.startsAt),
      location: r.location ?? "",
      notes: r.notes ?? "",
    });
    setError(null);
  }

  function update(field: keyof RehearsalInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = { ...form };
    const res = editing
      ? await fetch(`/api/rehearsals/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/rehearsals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (res.ok) {
      startCreate();
      loadRehearsals();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function remove(r: Rehearsal) {
    if (!confirm(`Probe "${r.title}" löschen?`)) return;
    const res = await fetch(`/api/rehearsals/${r.id}`, { method: "DELETE" });
    if (res.ok) {
      if (selected?.id === r.id) setSelected(null);
      loadRehearsals();
    } else {
      setError("Löschen fehlgeschlagen");
    }
  }

  async function openAttendance(r: Rehearsal) {
    setSelected(r);
    setAttError(null);
    setAttMsg(null);
    setAttLoading(true);

    const res = await fetch(`/api/rehearsals/${r.id}/attendance`);
    let existing: AttendanceRow[] = [];
    if (res.ok) {
      const data = await res.json();
      existing = (data.attendance ?? []).map((a: AttendanceRow) => ({
        id: a.id,
        memberId: a.memberId,
        status: a.status,
        note: a.note ?? "",
      }));
    }

    // Vollständige Massenliste: alle Mitglieder, bestehende Einträge vorbelegt.
    const byMember = new Map(existing.map((e) => [e.memberId, e]));
    const full = members.map((m) => {
      const found = byMember.get(m.id);
      return found ?? { id: null, memberId: m.id, status: "ABSENT" as const, note: "" };
    });
    setRows(full);
    setAttLoading(false);
  }

  function setStatus(memberId: string, status: AttendanceRow["status"]) {
    setRows((prev) =>
      prev.map((r) => (r.memberId === memberId ? { ...r, status } : r))
    );
  }

  function setNote(memberId: string, note: string) {
    setRows((prev) =>
      prev.map((r) => (r.memberId === memberId ? { ...r, note } : r))
    );
  }

  async function saveAttendance(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setAttSaving(true);
    setAttError(null);
    setAttMsg(null);

    const res = await fetch(`/api/rehearsals/${selected.id}/attendance`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: rows.map(({ memberId, status, note }) => ({ memberId, status, note })),
      }),
    });

    setAttSaving(false);
    if (res.ok) {
      setAttMsg("Anwesenheit gespeichert.");
      loadRehearsals();
    } else {
      const data = await res.json().catch(() => ({}));
      setAttError(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Proben ({rehearsals.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : rehearsals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Proben.</p>
          ) : (
            <ul className="divide-y">
              {rehearsals.map((r) => (
                <li key={r.id} className="py-2">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => openAttendance(r)}
                    >
                      <p className="font-medium">
                        {r.title}{" "}
                        {selected?.id === r.id && (
                          <span className="text-xs text-primary">· Anwesenheit</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(r.startsAt)}
                        {r.location ? ` · ${r.location}` : ""}
                        {r._count
                          ? ` · ${r._count.attendances} erfasst`
                          : ""}
                      </p>
                    </button>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(r)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(r)}
                      >
                        Löschen
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {editing ? "Probe bearbeiten" : "Neue Probe"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <Input
                placeholder="Titel"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
              />
              <Input
                placeholder="Beginn"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => update("startsAt", e.target.value)}
                required
              />
              <Input
                placeholder="Ort"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
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

        {selected && (
          <Card>
            <CardHeader>
              <CardTitle>Anwesenheit – {selected.title}</CardTitle>
            </CardHeader>
            <CardContent>
              {attLoading ? (
                <p className="text-sm text-muted-foreground">Lade…</p>
              ) : (
                <form onSubmit={saveAttendance} className="space-y-3">
                  <ul className="divide-y">
                    {rows.map((row) => {
                      const m = members.find((x) => x.id === row.memberId);
                      return (
                        <li
                          key={row.memberId}
                          className="flex items-center gap-2 py-2"
                        >
                          <span className="flex-1 text-sm">
                            {m
                              ? `${m.firstName} ${m.lastName}`
                              : row.memberId}{" "}
                            <span className="text-xs text-muted-foreground">
                              {m?.instrument}
                            </span>
                          </span>
                          <select
                            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                            value={row.status}
                            onChange={(e) =>
                              setStatus(
                                row.memberId,
                                e.target.value as AttendanceRow["status"]
                              )
                            }
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {STATUS_LABEL[s]}
                              </option>
                            ))}
                          </select>
                          <input
                            className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm"
                            placeholder="Notiz"
                            value={row.note}
                            onChange={(e) => setNote(row.memberId, e.target.value)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  {attError && (
                    <p className="text-sm text-destructive">{attError}</p>
                  )}
                  {attMsg && (
                    <p className="text-sm text-primary">{attMsg}</p>
                  )}
                  <Button type="submit" disabled={attSaving || rows.length === 0}>
                    {attSaving ? "Speichern…" : "Anwesenheit speichern"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
