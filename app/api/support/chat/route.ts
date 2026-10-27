import { isSupportChatEnabled, streamSupportAnswer } from "@/lib/aiSupport";
import { enforceAiBudget, clientIpFromHeaders } from "@/lib/rateLimit";
import { parseSupportRequest, type SupportStreamEvent } from "@/lib/supportChat";
import { claimSupportTurn, completeSupportTurn, failSupportTurn, supportTurnView, SupportChatError } from "@/lib/supportConversations";
import { SUPPORT_HEADERS, supportError, supportUser } from "@/lib/supportHttp";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  try {
    const user = await supportUser();
    const body = await req.json().catch(() => null);
    const request = parseSupportRequest(body);
    if (!request) throw new SupportChatError("Enter a message of up to 2,000 characters.", 400);
    if (!isSupportChatEnabled()) throw new SupportChatError("Support chat is unavailable right now.", 503);
    const budget = await enforceAiBudget(user.id, clientIpFromHeaders(req.headers));
    if (budget) return Response.json({ error: "You're sending messages too fast. Please try again shortly." },
      { status: 429, headers: { ...SUPPORT_HEADERS, "Retry-After": String(budget.retryAfterSec) } });

    const { turn, history, replay } = await claimSupportTurn(user, request);
    const encoder = new TextEncoder();
    const abort = new AbortController();
    let cancelled = req.signal.aborted;
    const onAbort = () => { cancelled = true; abort.abort(); };
    req.signal.addEventListener("abort", onAbort, { once: true });
    if (cancelled) abort.abort();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: SupportStreamEvent) => {
          if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };
        try {
          emit({ type: "start", conversationId: turn.conversationId });
          if (replay) {
            emit({ type: "done", turn: supportTurnView(turn) });
            return;
          }
          let answer = "";
          for await (const text of streamSupportAnswer(history, abort.signal, { requireComplete: true })) {
            answer += text;
            emit({ type: "delta", text });
          }
          if (!answer.trim() || abort.signal.aborted) throw new Error("Incomplete response");
          const saved = await completeSupportTurn(turn, answer);
          emit({ type: "done", turn: saved });
        } catch {
          try { await failSupportTurn(turn); }
          catch { console.error("Could not mark support reply interrupted"); }
          emit({ type: "error", message: "The reply was interrupted. Please retry your question." });
        } finally {
          req.signal.removeEventListener("abort", onAbort);
          if (!cancelled) controller.close();
        }
      },
      cancel() { onAbort(); },
    });
    return new Response(stream, { headers: { ...SUPPORT_HEADERS, "Content-Type": "text/event-stream; charset=utf-8" } });
  } catch (error) { return supportError(error); }
}
