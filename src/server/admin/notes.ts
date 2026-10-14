import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import type { TypedClient } from "@/server/db/types";

type NoteInsert = Database["public"]["Tables"]["client_notes"]["Insert"];

export const noteInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("note"), body: z.string().trim().min(1, "Напиши бележка").max(2000) }),
  z.object({ kind: z.literal("call"), body: z.string().trim().max(2000).default("") }),
  z.object({ kind: z.literal("snooze"), days: z.number().int().min(1).max(60) }),
]);

export async function addNote(db: TypedClient, userId: string, raw: unknown): Promise<void> {
  const note = noteInputSchema.parse(raw);
  const row: NoteInsert =
    note.kind === "snooze"
      ? {
          user_id: userId,
          kind: note.kind,
          body: `Отложено с ${note.days} дни`,
          snooze_until: new Date(Date.now() + note.days * 86_400_000).toISOString(),
        }
      : { user_id: userId, kind: note.kind, body: note.body };
  const { error } = await db.from("client_notes").insert(row);
  if (error) throw new Error(`add note failed: ${error.message}`);
}

export async function recordMessage(db: TypedClient, userId: string, body: string): Promise<void> {
  const { error } = await db
    .from("client_notes")
    .insert({ user_id: userId, kind: "message", body: body.slice(0, 2000) });
  if (error) throw new Error(`record message failed: ${error.message}`);
}
