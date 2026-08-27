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
import {
  instrumentCondition,
  instrumentRegister,
} from "@/lib/validations/enums";

type MemberLight = { id: string; firstName: string; lastName: string };

type MemberOfInstrument = {
  id: string;
  firstName: string;
  lastName: string;
} | null;

type Instrument = {
  id: string;
  type: string;
  inventoryNumber: string;
  condition: string;
  notes: string | null;
  memberId: string | null;
  member: MemberOfInstrument;
};

type InstrumentInput = {
  type: string;
  inventoryNumber: string;
  condition: string;
  memberId: string;
  notes: string;
};

const REGISTERS = instrumentRegister.options;
const CONDITIONS = instrumentCondition.options;

const EMPTY: InstrumentInput = {
  type: REGISTERS[0],
  inventoryNumber: "",
  condition: CONDITIONS[0],
  memberId: "",
  notes: "",
};

export function InstrumentsManager() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [members, setMembers] = useState<MemberLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Instrument | null>(null);
  const [form, setForm] = useState<InstrumentInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/instruments");
    if (res.ok) {
      const data = await res.json();
      setInstruments(data.instruments ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
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

  function startEdit(inst: Instrument) {
    setEditing(inst);
    setForm({
      type: inst.type,
      inventoryNumber: inst.inventoryNumber,
      condition: inst.condition,
      memberId: inst.memberId ?? "",
      notes: inst.notes ?? "",
    });
    setError(null);
  }

  function update(field: keyof InstrumentInput, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = { ...form };
    if (!payload.memberId) payload.memberId = null;

    const res = editing
      ? await fetch(`/api/instruments/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/instruments", {
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

  async function remove(inst: Instrument) {
    if (!confirm(`Instrument "${inst.type} (${inst.inventoryNumber})" löschen?`))
      return;
    const res = await fetch(`/api/instruments/${inst.id}`, { method: "DELETE" });
    if (res.ok) load();
    else setError("Löschen fehlgeschlagen");
  }

  function memberLabel(m: MemberLight) {
    return `${m.firstName} ${m.lastName}`;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Instrumente ({instruments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Lade…</p>
          ) : instruments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Instrumente.</p>
          ) : (
            <ul className="divide-y">
              {instruments.map((inst) => (
                <li
                  key={inst.id}
                  className="flex items-center justify-between py-2"
                >
                  <div>
                    <p className="font-medium">
                      {inst.type}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({inst.inventoryNumber})
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {inst.condition}
                      {inst.member
                        ? ` · verliehen an ${inst.member.firstName} ${inst.member.lastName}`
                        : " · im Bestand"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(inst)}
                    >
                      Bearbeiten
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(inst)}
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
            {editing ? "Instrument bearbeiten" : "Neues Instrument"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Register</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.type}
                  onChange={(e) => update("type", e.target.value)}
                  required
                >
                  {REGISTERS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                placeholder="Inventarnummer"
                value={form.inventoryNumber}
                onChange={(e) => update("inventoryNumber", e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Zustand</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.condition}
                  onChange={(e) => update("condition", e.target.value)}
                  required
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Verliehen an</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.memberId}
                  onChange={(e) => update("memberId", e.target.value)}
                >
                  <option value="">– im Bestand –</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {memberLabel(m)}
                    </option>
                  ))}
                </select>
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
