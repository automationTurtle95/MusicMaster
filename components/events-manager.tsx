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

type MemberSummary = {
  id: string;
  firstName: string;
  lastName: string;
  instrument: string;
};

type CastEntry = {
  memberId: string;
  role: string;
};

type EventMember = MemberSummary & { role: string | null };

type Event = {
  id: string;
  title: string;
  startsAt: string;
  location: string;
  notes: string | null;
  eventMembers: EventMember[];
};

type EventInput = {
  title: string;
  startsAt: string;
  location: string;
  notes: string;
  members: CastEntry[];
};

const EMPTY: EventInput = {
  title: "",
  startsAt: "",
  location: "",
  notes: "",
  members: [],
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function EventsManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Event | null>(null);
  const [form, setForm] = useState<EventInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEvents() {
    setLoading(true);
    const res = await fetch("/api/events");
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
    fetch("/api/members")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers(d.members ?? []))
      .catch(() => setMembers([]));
  }, []);

  function startCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
  }

  function startEdit(e: Event) {
    setEditing(e);
    setForm({
      title: e.title,
      startsAt: toLocalInput(e.startsAt),
      location: e.location,
      notes: e.notes ?? "",
      members: e.eventMembers.map((m) => ({
        memberId: m.id,
        role: m.role ?? "",
      })),
    });
    setError(null);
  }

  function update(field: keyof EventInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateCast(index: number, field: "memberId" | "role", value: string) {
    setForm((prev) => ({
      ...prev,
      members: prev.members.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      ),
    }));
  }

  function addCastRow() {
    setForm((prev) => ({
      ...prev,
      members: [...prev.members, { memberId: "", role: "" }],
    }));
  }

  function removeCastRow(index: number) {
    setForm((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      title: form.title,
      startsAt: form.startsAt,
      location: form.location,
      notes: form.notes || undefined,
      members: form.members
        .filter((m) => m.memberId)
        .map((m) => ({ memberId: m.memberId, role: m.role || undefined })),
    };

    const res = editing
      ? await fetch(`/api/events/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (res.ok) {
      startCreate();
      loadEvents();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function remove(e: Event) {
    if (!confirm(`Auftritt "${e.title}" löschen?`)) return;
    const res = await fetch(`/api/events/${e.id}`, { method: "DELETE" });
    if (res.ok) loadEvents();
    else setError("Löschen fehlgeschlagen");
  }

  function memberLabel(m: MemberSummary) {
    return `${m.firstName} ${m.lastName} (${m.instrument})`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Auftritte ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Auftritte.</p>
          ) : (
            <ul className="divide-y">
              {events.map((e) => (
                <li key={e.id} className="py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.startsAt).toLocaleString("de-DE")}
                        {" · "}
                        {e.location}
                      </p>
                      {e.eventMembers.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Besetzung:{" "}
                          {e.eventMembers
                            .map(
                              (m) =>
                                `${m.firstName} ${m.lastName}${
                                  m.role ? ` (${m.role})` : ""
                                }`
                            )
                            .join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(e)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(e)}
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

      <Card>
        <CardHeader>
          <CardTitle>
            {editing ? "Auftritt bearbeiten" : "Neuer Auftritt"}
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
              required
            />
            <textarea
              placeholder="Notizen"
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
            />

            <div className="space-y-2">
              <p className="text-sm font-medium">Besetzung</p>
              {form.members.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={row.memberId}
                    onChange={(e) => updateCast(i, "memberId", e.target.value)}
                  >
                    <option value="">Mitglied wählen…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {memberLabel(m)}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="Rolle"
                    value={row.role}
                    onChange={(e) => updateCast(i, "role", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeCastRow(i)}
                  >
                    –
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addCastRow}
              >
                + Mitglied hinzufügen
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Speichern…" : editing ? "Speichern" : "Anlegen"}
              </Button>
              {editing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={startCreate}
                >
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
