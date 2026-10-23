"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { addProgressPhoto } from "@/app/app/progress/photos/actions";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { compressPhoto } from "@/lib/progress-photos/compress";
import { photoPath } from "@/lib/progress-photos/path";
import { uploadErrorMessage } from "@/lib/progress-photos/upload-errors";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const BUCKET = "progress-photos";

/**
 * Adds a photo: re-encodes it in the browser (smaller, no EXIF), uploads it to her own folder, then
 * records it. If recording fails after the upload, the stored object is removed again.
 */
export function PhotoUpload({
  userId,
  today,
  variant = "primary",
}: {
  userId: string;
  today: string;
  variant?: "primary" | "secondary";
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [takenOn, setTakenOn] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!takenOn || takenOn > today) {
      setError("Избери дата до днес.");
      return;
    }
    setBusy(true);
    try {
      const blob = await compressPhoto(file);
      const storage = createBrowserSupabaseClient().storage.from(BUCKET);
      const path = photoPath(userId, crypto.randomUUID());
      const { error: uploadError } = await storage.upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const result = await addProgressPhoto({ path, takenOn }).catch(() => null);
      if (!result?.ok) {
        // Do not leave an unrecorded object behind; a failed cleanup is not worth a second message.
        await storage.remove([path]).catch(() => null);
        setError(result ? result.message : uploadErrorMessage(null));
        return;
      }
      router.refresh();
    } catch (caught) {
      setError(uploadErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Дата на снимката</span>
          <input
            type="date"
            value={takenOn}
            max={today}
            min="2000-01-01"
            onChange={(event) => setTakenOn(event.target.value)}
            disabled={busy}
            className="h-11 rounded-xl bg-white px-3 text-base ring-1 ring-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
          />
        </label>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className={cn(buttonClass(variant, "md"))}
        >
          <Camera size={18} strokeWidth={2} aria-hidden="true" />
          {busy ? "Качваме…" : "Добави снимка"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          onChange={(event) => {
            const input = event.currentTarget;
            const file = input.files?.[0];
            if (file) void upload(file);
            // Clear it so choosing the same file again still fires onChange.
            input.value = "";
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm font-semibold text-brick">
          {error}
        </p>
      )}
    </div>
  );
}
