/** The browser's IANA timezone (e.g. "Europe/Sofia"), or undefined when it can't be read. */
export function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}
