/**
 * Shared support-chat constants and types — safe to import from BOTH client and
 * server. (lib/aiSupport.ts is server-only because it holds the Gemini call; the
 * client widget needs these caps too, so they live here to avoid dragging
 * server-only code into the client bundle.)
 */

/** Caps that keep a single turn cheap and bounded (enforced in the route). */
export const MAX_SUPPORT_MESSAGE_CHARS = 2_000;
export const MAX_SUPPORT_HISTORY = 20;

export type SupportRole = "user" | "assistant";
export type SupportMessage = { role: SupportRole; content: string };

export const SUPPORT_IDLE_MS = 24 * 60 * 60 * 1000;
export const SUPPORT_RETENTION_MS = 30 * SUPPORT_IDLE_MS;
export const SUPPORT_ATTEMPT_MS = 60_000;

export type SupportTurnView = {
  id: string;
  question: string;
  answer: string | null;
  status: "PENDING" | "COMPLETE" | "FAILED";
  createdAt: string;
};
export type SupportConversationSummary = { id: string; title: string; lastMessageAt: string };
export type SupportHistory = {
  conversations: SupportConversationSummary[];
  nextCursor: string | null;
  currentConversationId: string | null;
};
export type SupportTranscript = {
  conversation: SupportConversationSummary;
  turns: SupportTurnView[];
  nextCursor: string | null;
};
export type SupportRequest = { conversationId: string | null; requestId: string; message: string };
export type SupportStreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "delta"; text: string }
  | { type: "done"; turn: SupportTurnView }
  | { type: "error"; message: string };

export function isSupportId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
}

export function parseSupportRequest(value: unknown): SupportRequest | null {
  if (!value || typeof value !== "object") return null;
  const { conversationId, requestId, message } = value as Record<string, unknown>;
  if (conversationId != null && !isSupportId(conversationId)) return null;
  if (!isSupportId(requestId) || typeof message !== "string") return null;
  const text = message.trim();
  if (!text || text.length > MAX_SUPPORT_MESSAGE_CHARS) return null;
  return { conversationId: conversationId ?? null, requestId, message: text };
}
