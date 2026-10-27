import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SupportChatError } from "@/lib/supportConversations";
import { isSupportId } from "@/lib/supportChat";

export const SUPPORT_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function supportUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new SupportChatError("Please sign in to chat with support.", 401);
  return user;
}

export function supportCursor(req: Request) {
  const cursor = new URL(req.url).searchParams.get("cursor");
  if (cursor !== null && !isSupportId(cursor)) throw new SupportChatError("Invalid page cursor.", 400);
  return cursor;
}

export function supportError(error: unknown) {
  const known = error instanceof SupportChatError;
  if (!known) console.error("Support chat operation failed", error instanceof Error ? error.name : "Unknown error");
  return Response.json({ error: known ? error.message : "Support chat is unavailable right now. Please try again." },
    { status: known ? error.status : 503, headers: SUPPORT_HEADERS });
}
