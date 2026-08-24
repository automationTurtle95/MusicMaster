"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Todo = { id: string; title: string; due: string; overdue: boolean; done?: boolean };

const INITIAL_TODOS: Todo[] = [
  { id: "t1", title: "Beiträge 2026/27 erfassen", due: "bis 31.08.", overdue: false },
  { id: "t2", title: "GEMA-Meldung Q3 vorbereiten", due: "bis 15.09.", overdue: false },
  {
    id: "t3",
    title: "Probenplan Dezember abstimmen",
    due: "überfällig",
    overdue: true,
  },
  {
    id: "t4",
    title: "Neue Noten einpflegen",
    due: "bis 10.09.",
    overdue: false,
  },
];

export function TodoList() {
  const [todos, setTodos] = useState(INITIAL_TODOS);

  function toggle(id: string) {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
  }

  const items = todos;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zu erledigen</CardTitle>
        <CardDescription>Aufgaben & Fristen</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {items.map((todo) => (
            <li key={todo.id}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md p-1 hover:bg-accent/50">
                <input
                  type="checkbox"
                  checked={Boolean(todo.done)}
                  onChange={() => toggle(todo.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    todo.done && "text-muted-foreground line-through"
                  )}
                >
                  {todo.title}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    todo.overdue ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {todo.due}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <p className="pt-2 text-xs text-muted-foreground">
          Platzhalter-Aufgaben (kein Aufgabenmodell in MusicMaster).
        </p>
      </CardContent>
    </Card>
  );
}
