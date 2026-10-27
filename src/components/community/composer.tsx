"use client";

import { Camera, X } from "lucide-react";
import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import { createPostAction, type ComposerState } from "@/app/app/community/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { inputOnCardClass } from "@/components/ui/field";
import { compressPhoto } from "@/lib/progress-photos/compress";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const BUCKET = "community-photos";
const IDLE: ComposerState = { status: "idle" };

/**
 * New post: text plus one optional photo. The photo is re-encoded in the browser (smaller, no
 * EXIF), uploaded to her own folder, and its path travels with the form; the RPC checks it exists.
 */
export function Composer({
  userId,
  initialBody = "",
  completionId = null,
}: {
  userId: string;
  initialBody?: string;
  completionId?: string | null;
}) {
  const [state, action, pending] = useActionState(createPostAction, IDLE);
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function pick(file: File) {
    setPhotoError("");
    setUploading(true);
    const storage = createBrowserSupabaseClient().storage.from(BUCKET);
    const path = `${userId}/${crypto.randomUUID()}.jpg`;
    try {
      const blob = await compressPhoto(file);
      const { error } = await storage.upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      if (photo) await storage.remove([photo.path]).catch(() => null);
      setPhoto({ path, preview: URL.createObjectURL(blob) });
    } catch {
      setPhotoError("Снимката не се качи. Опитай с друга.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto() {
    if (!photo) return;
    const { path } = photo;
    setPhoto(null);
    await createBrowserSupabaseClient()
      .storage.from(BUCKET)
      .remove([path])
      .catch(() => null);
  }

  return (
    <Card className="p-4">
      <form action={action} className="space-y-3">
        <label className="block">
          <span className="sr-only">Какво искаш да споделиш?</span>
          <textarea
            name="body"
            required
            maxLength={1000}
            rows={3}
            placeholder="Какво искаш да споделиш?"
            defaultValue={state.status === "error" ? state.body : initialBody}
            className={inputOnCardClass}
          />
        </label>
        <input type="hidden" name="photoPath" value={photo?.path ?? ""} />
        <input type="hidden" name="completionId" value={completionId ?? ""} />
        {photo && (
          <div className="relative w-fit">
            <Image
              src={photo.preview}
              alt=""
              width={160}
              height={160}
              unoptimized
              className="size-40 rounded-xl object-cover"
            />
            <button
              type="button"
              onClick={() => void removePhoto()}
              aria-label="Махни снимката"
              className="absolute -right-2 -top-2 inline-flex size-9 items-center justify-center rounded-full bg-ink text-white"
            >
              <X size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-sm font-semibold text-ink ring-[1.5px] ring-ink ring-inset">
            <Camera size={18} strokeWidth={2.25} aria-hidden="true" />
            {uploading ? "Качва се…" : photo ? "Смени снимката" : "Снимка"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void pick(file);
              }}
            />
          </label>
          <Button type="submit" size="md" disabled={pending || uploading} className="ml-auto">
            {pending ? "Момент…" : "Публикувай"}
          </Button>
        </div>
        {(photoError || state.status === "error") && (
          <p role="alert" className="text-sm font-semibold text-brick">
            {photoError || state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
