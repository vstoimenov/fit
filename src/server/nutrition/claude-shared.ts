import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

/** Only the call the nutrition AI features use, so tests can pass a fake. */
export type ClaudeClient = { beta: { messages: Pick<Anthropic["beta"]["messages"], "parse"> } };

/** The estimator's options: the SDK allows 10 s in total, so a failed call is not retried: the member would wait twice as long. */
export const CLAUDE_CLIENT_OPTIONS = { timeout: 10_000, maxRetries: 0 } as const;

/** Angle brackets are swapped for look-alikes, so user text can never form or close a tag. */
export function neutraliseAngles(text: string): string {
  return text.replaceAll("<", "‹").replaceAll(">", "›");
}

/** `<tag>text</tag>` with the text neutralised. */
export function wrapTag(tag: string, text: string): string {
  return `<${tag}>${neutraliseAngles(text)}</${tag}>`;
}
