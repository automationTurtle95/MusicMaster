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

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  zip: string | null;
  instrument: string;
  active: boolean;
  joinedAt: string | null;
  notes: string | null;
};

type MemberInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  zip: string;
  instrument: string;
  active: boolean;
  joinedAt: string;
  notes: string;
};

const EMPTY: MemberInput = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  zip: "",
  instrument: "",
  active: true,
  joinedAt: "",
  notes: "",
};

export function MembersManager() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<MemberInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/members");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
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
  }

  function startEdit(m: Member) {
    setEditing(m);
    setForm({
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email ?? "",
      phone: m.phone ?? "",
      street: m.street ?? "",
      city: m.city ?? "",
      zip: m.zip ?? "",
      instrument: m.instrument,
      active: m.active,
      joinedAt: m.joinedAt ? m.joinedAt.slice(0, 10) : "",
      notes: m.notes ?? "",
    });
    setError(null);
  }

  function update(field: keyof MemberInput, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = { ...form };
    if (!payload.email) payload.email = "";
    if (!payload.joinedAt) delete payload.joinedAt;

    const res = editing
      ? await fetch(`/api/members/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setSaving(false);
    if (res.ok) {
      startCreate();
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Speichern fehlgeschlagen");
    }
  }

  async function remove(m: Member) {
    if (!confirm(`Mitglied "${m.firstName} ${m.lastName}" löschen?`)) return;
    const res = await fetch(`/api/members/${m.id}`, { method: "DELETE" });
    if (res.ok) load();
    else setError("Löschen fehlgeschlagen");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mitglieder ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Mitglieder.</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="font-medium">
                      {m.firstName} {m.lastName}{" "}
                      {!m.active && (
                        <span className="text-xs text-muted-foreground">
                          (inaktiv)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.instrument}
                      {m.email ? ` · ${m.email}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(m)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(m)}
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
            {editing ? "Mitglied bearbeiten" : "Neues Mitglied"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Vorname"
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                required
              />
              <Input
                placeholder="Nachname"
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                required
              />
            </div>
            <Input
              placeholder="E-Mail"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
            <Input
              placeholder="Telefon"
              value={form.phone}
              onChange={(e) => update("phone", e.target.value)}
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                placeholder="Straße"
                value={form.street}
                onChange={(e) => update("street", e.target.value)}
              />
              <Input
                placeholder="PLZ"
                value={form.zip}
                onChange={(e) => update("zip", e.target.value)}
              />
              <Input
                placeholder="Ort"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
              />
            </div>
            <Input
              placeholder="Instrument"
              value={form.instrument}
              onChange={(e) => update("instrument", e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Beitritt (TT.MM.JJJJ)"
                type="date"
                value={form.joinedAt}
                onChange={(e) => update("joinedAt", e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => update("active", e.target.checked)}
                />
                Aktiv
              </label>
            </div>
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
