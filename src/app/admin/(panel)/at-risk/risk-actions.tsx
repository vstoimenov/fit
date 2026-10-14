"use client";

import { useRef, useState, useTransition } from "react";
import { ActionForm } from "@/components/admin/action-form";
import { Button, buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/field";
import { nudgeAction, quickNoteAction, snoozeAction } from "./actions";

export function RiskActions({ userId, phone }: { userId: string; phone: string | null }) {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);

  function run(work: () => Promise<string>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setMessage("");
    startTransition(async () => {
      try {
        setMessage(await work());
      } catch {
        setMessage("Нещо се обърка. Опитай отново.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {phone && (
          <a href={`tel:${phone}`} className={buttonClass("primary", "md")}>
            Обади се
          </a>
        )}
        <Button
          variant="quiet"
          size="md"
          disabled={pending}
          onClick={() => {
            if (!confirm("Да изпратя ли имейла по шаблон?")) return;
            run(async () => {
              const r = await nudgeAction(userId);
              if (!r.ok) return r.message;
              return r.data.delivered
                ? "Изпратено ✓"
                : "Записано, но НЕ е изпратено (няма имейл доставчик)";
            });
          }}
        >
          Изпрати съобщение
        </Button>
        <Button
          variant="quiet"
          size="md"
          disabled={pending}
          onClick={() =>
            run(async () => {
              const r = await snoozeAction(userId);
              return r.ok ? "Отложено със 7 дни ✓" : r.message;
            })
          }
        >
          Отложи 7 дни
        </Button>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </div>
      <details>
        <summary className="cursor-pointer py-2 text-sm font-semibold text-ink-soft">
          Запиши обаждане или бележка
        </summary>
        <div className="pt-2">
          <ActionForm
            action={quickNoteAction.bind(null, userId)}
            submitLabel="Запиши"
            resetOnSuccess
            className="space-y-2"
          >
            <div className="flex flex-wrap gap-2">
              <select
                name="kind"
                defaultValue="call"
                aria-label="Вид"
                className={inputClass + " h-11 max-w-[10rem]"}
              >
                <option value="call">Обаждане</option>
                <option value="note">Бележка</option>
              </select>
              <input
                name="body"
                placeholder="Как мина разговорът?"
                aria-label="Текст"
                maxLength={2000}
                className={inputClass + " h-11 min-w-0 flex-1"}
              />
            </div>
          </ActionForm>
        </div>
      </details>
    </div>
  );
}
