"use client";

import { Flag, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  deleteOwnCommentAction,
  deleteOwnPostAction,
  reportAction,
} from "@/app/app/community/actions";
import { cn } from "@/lib/cn";

const BTN =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** Report (others' content) or delete (own) for a post or a comment. */
export function PostMenu({
  target,
  mine,
  postId,
}: {
  target: { postId?: string; commentId?: string };
  mine: boolean;
  /** For comments: the post to refresh after deleting. */
  postId: string;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (busy) return;
    if (!window.confirm("Да изтрием това?")) return;
    setBusy(true);
    const result = target.commentId
      ? await deleteOwnCommentAction(target.commentId, postId)
      : await deleteOwnPostAction(target.postId!);
    setBusy(false);
    if (result && !result.ok) setNote(result.message);
  }

  async function report() {
    if (busy) return;
    setBusy(true);
    const result = await reportAction(target, reason);
    setBusy(false);
    setReporting(false);
    setReason("");
    setNote(result.ok ? "Благодарим, ще го прегледаме." : result.message);
  }

  if (mine) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button type="button" onClick={() => void remove()} disabled={busy} className={BTN}>
          <Trash2 size={16} strokeWidth={2.25} aria-hidden="true" />
          Изтрий
        </button>
        {note && <p className="text-xs text-brick">{note}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {reporting ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void report();
          }}
          className="flex w-full flex-col gap-2 sm:w-72"
        >
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Какво не е наред? (по избор)"
            className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm"
            aria-label="Причина за сигнала"
          />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={cn(BTN, "bg-ink text-white")}>
              Изпрати сигнал
            </button>
            <button type="button" onClick={() => setReporting(false)} className={BTN}>
              Отказ
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setReporting(true)} className={BTN}>
          <Flag size={16} strokeWidth={2.25} aria-hidden="true" />
          Сигнал
        </button>
      )}
      {note && (
        <p className="text-xs text-ink-soft" role="status">
          {note}
        </p>
      )}
    </div>
  );
}
