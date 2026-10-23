const MESSAGE = "Моят прогрес с I AM STRONG 💪";

/** Share caption: the message, then the site URL on its own line when one is given. */
export function progressShareText(siteUrl: string): string {
  const url = siteUrl.trim();
  return url ? `${MESSAGE}\n${url}` : MESSAGE;
}
