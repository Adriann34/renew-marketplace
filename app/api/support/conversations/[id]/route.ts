import { isSupportId } from "@/lib/supportChat";
import { getSupportTranscript, SupportChatError } from "@/lib/supportConversations";
import { SUPPORT_HEADERS, supportCursor, supportError, supportUser } from "@/lib/supportHttp";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await supportUser();
    const { id } = await context.params;
    if (!isSupportId(id)) throw new SupportChatError("Conversation not found.", 404);
    return Response.json(await getSupportTranscript(user.id, id, supportCursor(req)), { headers: SUPPORT_HEADERS });
  } catch (error) { return supportError(error); }
}
