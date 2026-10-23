/** True when she closed the share sheet (or cancelled the share): not an error. */
export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Saves the file under its own name via a temporary link. Browser only. */
export function downloadFile(file: File) {
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  // Generous delay: some browsers start reading the blob for the download only later.
  setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

/** Copies text to the clipboard; false when the browser blocks it. */
export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
