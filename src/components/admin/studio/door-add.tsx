"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  doorAddAction,
  doorWalkInAction,
  searchClientsAction,
} from "@/app/admin/(panel)/zala/actions";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { inputOnCardClass } from "@/components/ui/field";
import type { ClientHit } from "@/server/studio/today";
import { WalkInFields } from "./walkin-fields";

/**
 * „+ На вратата“: search any client by name or phone and tap to book + tick her; or create a new
 * one with name and phone. `hereIds` are already on the list and are not offered again.
 */
export function DoorAdd({ sessionId, hereIds }: { sessionId: string; hereIds: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = setTimeout(async () => {
      const res = await searchClientsAction(q);
      setHits(res.ok ? res.data.filter((h) => !hereIds.includes(h.userId)) : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [q, hereIds]);

  if (!open) {
    return (
      <Button variant="secondary" size="md" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" aria-hidden />
        На вратата
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-sand p-4">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Име или телефон"
        aria-label="Търси клиентка по име или телефон"
        className={inputOnCardClass}
      />
      {q.trim().length >= 2 && (
        <ul className="space-y-2">
          {hits.map((h) => (
            <li key={h.userId}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await doorAddAction(sessionId, h.userId);
                    setMessage(
                      res.ok ? `${h.name || "Клиентката"}: ${res.data.message}` : res.message,
                    );
                    if (res.ok) {
                      setQ("");
                      setHits([]);
                      router.refresh();
                    }
                  })
                }
                className="flex min-h-12 w-full items-center justify-between rounded-xl bg-white px-4 text-left ring-1 ring-line"
              >
                <span className="font-semibold">{h.name || "Без име"}</span>
                <span className="text-sm text-ink-soft">{h.phone}</span>
              </button>
            </li>
          ))}
          {hits.length === 0 && <li className="text-sm text-ink-soft">Няма такава клиентка.</li>}
        </ul>
      )}
      {message && (
        <p role="status" className="text-sm font-semibold">
          {message}
        </p>
      )}
      <details className="rounded-xl bg-white p-3 ring-1 ring-line">
        <summary className="cursor-pointer text-sm font-semibold">Нова клиентка</summary>
        <div className="pt-3">
          <ActionForm
            action={doorWalkInAction.bind(null, sessionId)}
            submitLabel="Добави и отметни"
            resetOnSuccess
          >
            <WalkInFields />
          </ActionForm>
        </div>
      </details>
      <Button variant="link" onClick={() => setOpen(false)}>
        Затвори
      </Button>
    </div>
  );
}
