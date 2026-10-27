import { getSupportHistory } from "@/lib/supportConversations";
import { SUPPORT_HEADERS, supportCursor, supportError, supportUser } from "@/lib/supportHttp";

export async function GET(req: Request) {
  try {
    const user = await supportUser();
    return Response.json(await getSupportHistory(user.id, supportCursor(req)), { headers: SUPPORT_HEADERS });
  } catch (error) { return supportError(error); }
}
