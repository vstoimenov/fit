"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { AdminWorkout } from "@/server/admin/workouts";
import { reorderStartersAction } from "./actions";

export function StarterOrder({ starters }: { starters: AdminWorkout[] }) {
  const [items, setItems] = useState(starters);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function move(index: number, delta: number) {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item!);
    setItems(next);
  }

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <h2 className="font-semibold">Стартова седмица (ред)</h2>
      <ol className="space-y-2">
        {items.map((w, i) => (
          <li key={w.id} className="flex items-center gap-2 text-sm">
            <span className="w-6 text-ink-soft">{i + 1}.</span>
            <span className="flex-1">{w.title}</span>
            <Button
              variant="quiet"
              size="md"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label="Нагоре"
            >
              ↑
            </Button>
            <Button
              variant="quiet"
              size="md"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
              aria-label="Надолу"
            >
              ↓
            </Button>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-3">
        <Button
          size="md"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await reorderStartersAction(items.map((w) => w.id));
              setMessage(r.ok ? "Подредбата е запазена ✓" : r.message);
            })
          }
        >
          Запази реда
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
