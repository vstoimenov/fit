"use client";

import { useActionState } from "react";
import { createCommentAction, type ComposerState } from "@/app/app/community/actions";
import { Button } from "@/components/ui/button";
import { inputOnCardClass } from "@/components/ui/field";

const IDLE: ComposerState = { status: "idle" };

export function CommentForm({ postId }: { postId: string }) {
  const [state, action, pending] = useActionState(createCommentAction.bind(null, postId), IDLE);
  return (
    <form action={action} className="space-y-2">
      <label className="block">
        <span className="sr-only">Коментар</span>
        <textarea
          name="body"
          required
          maxLength={500}
          rows={2}
          placeholder="Напиши коментар…"
          defaultValue={state.status === "error" ? state.body : ""}
          className={inputOnCardClass}
        />
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {state.message}
        </p>
      )}
      <Button type="submit" size="md" variant="secondary" disabled={pending}>
        {pending ? "Момент…" : "Коментирай"}
      </Button>
    </form>
  );
}
