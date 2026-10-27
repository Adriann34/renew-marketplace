import "server-only";
import type { SupportTurn } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  MAX_SUPPORT_HISTORY, SUPPORT_ATTEMPT_MS, SUPPORT_IDLE_MS, SUPPORT_RETENTION_MS,
  type SupportMessage, type SupportRequest, type SupportTurnView,
} from "@/lib/supportChat";

export class SupportChatError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

const missing = () => new SupportChatError("Conversation not found or no longer available.", 404);
const retainedAfter = (now: Date) => new Date(now.getTime() - SUPPORT_RETENTION_MS);

export function supportTurnView(turn: SupportTurn, now = new Date()): SupportTurnView {
  return {
    id: turn.id, question: turn.question, answer: turn.answer, createdAt: turn.createdAt.toISOString(),
    status: turn.status === "PENDING" && now.getTime() - turn.startedAt.getTime() >= SUPPORT_ATTEMPT_MS
      ? "FAILED" : turn.status,
  };
}

export async function getSupportHistory(userId: string, cursor: string | null, now = new Date()) {
  const where = { userId, lastMessageAt: { gt: retainedAfter(now) } };
  const after = cursor ? await prisma.supportConversation.findFirst({ where: { ...where, id: cursor } }) : null;
  if (cursor && !after) throw missing();
  const rows = await prisma.supportConversation.findMany({
    where: { ...where, ...(after ? { OR: [
      { lastMessageAt: { lt: after.lastMessageAt, gt: retainedAfter(now) } },
      { lastMessageAt: after.lastMessageAt, id: { lt: after.id } },
    ] } : {}) },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: 21,
    select: { id: true, title: true, lastMessageAt: true },
  });
  const page = rows.slice(0, 20);
  return {
    conversations: page,
    nextCursor: rows.length > 20 ? page.at(-1)!.id : null,
    currentConversationId: !cursor && page[0] && now.getTime() - page[0].lastMessageAt.getTime() < SUPPORT_IDLE_MS
      ? page[0].id : null,
  };
}

export async function getSupportTranscript(userId: string, id: string, cursor: string | null, now = new Date()) {
  const conversation = await prisma.supportConversation.findFirst({
    where: { id, userId, lastMessageAt: { gt: retainedAfter(now) } },
    select: { id: true, title: true, lastMessageAt: true },
  });
  if (!conversation) throw missing();
  const after = cursor ? await prisma.supportTurn.findFirst({ where: { id: cursor, conversationId: id } }) : null;
  if (cursor && !after) throw missing();
  const rows = await prisma.supportTurn.findMany({
    where: { conversationId: id, ...(after ? { OR: [
      { createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } },
    ] } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 51,
  });
  const page = rows.slice(0, 50);
  return { conversation, nextCursor: rows.length > 50 ? page.at(-1)!.id : null,
    turns: page.reverse().map((turn) => supportTurnView(turn, now)) };
}

// A short user-row lock serializes claims, not AI generation. The partial unique
// index is a second guard against concurrent pending turns on different servers.
export async function claimSupportTurn(
  user: { id: string; email?: string }, request: SupportRequest, now = new Date(),
) {
  return prisma.$transaction(async (tx) => {
    await tx.user.upsert({ where: { id: user.id }, update: {},
      create: { id: user.id, email: user.email! } });
    await tx.$queryRaw`SELECT id FROM public."User" WHERE id = ${user.id} FOR UPDATE`;
    const existing = await tx.supportTurn.findUnique({
      where: { id: request.requestId }, include: { conversation: true },
    });
    if (existing && (existing.conversation.userId !== user.id ||
      existing.conversation.lastMessageAt <= retainedAfter(now))) throw missing();
    if (existing && (existing.question !== request.message ||
      (request.conversationId && existing.conversationId !== request.conversationId))) {
      throw new SupportChatError("This request has already been used for a different message.", 409);
    }
    const id = existing?.conversationId ?? request.conversationId;
    let conversation = id ? await tx.supportConversation.findFirst({
      where: { id, userId: user.id, lastMessageAt: { gt: retainedAfter(now) } },
    }) : null;
    if (id && !conversation) throw missing();
    if (existing?.status === "COMPLETE") return { turn: existing, history: [], replay: true };

    if (conversation) {
      await tx.supportTurn.updateMany({ where: { conversationId: conversation.id, status: "PENDING",
        startedAt: { lte: new Date(now.getTime() - SUPPORT_ATTEMPT_MS) } }, data: { status: "FAILED" } });
      const pending = await tx.supportTurn.findFirst({ where: { conversationId: conversation.id, status: "PENDING" } });
      if (pending) throw new SupportChatError("A reply is already being prepared. Please try again shortly.", 409);
      if (existing) {
        const latest = await tx.supportTurn.findFirst({ where: { conversationId: conversation.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
        if (latest?.id !== existing.id) throw new SupportChatError("Please send your question again to continue this chat.", 409);
      }
    } else {
      conversation = await tx.supportConversation.create({ data: {
        userId: user.id, title: request.message.slice(0, 100), createdAt: now, lastMessageAt: now,
      } });
    }
    const previous = await tx.supportTurn.findMany({
      where: { conversationId: conversation.id, status: "COMPLETE" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.floor((MAX_SUPPORT_HISTORY - 1) / 2),
    });
    const startedAt = new Date(Math.max(now.getTime(), (existing?.startedAt.getTime() ?? 0) + 1));
    const turn = existing
      ? await tx.supportTurn.update({ where: { id: existing.id }, data: { status: "PENDING", startedAt } })
      : await tx.supportTurn.create({ data: { id: request.requestId, conversationId: conversation.id,
        question: request.message, createdAt: now, startedAt } });
    await tx.supportConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } });
    const history: SupportMessage[] = previous.reverse().flatMap((item) => [
      { role: "user" as const, content: item.question }, { role: "assistant" as const, content: item.answer! },
    ]);
    history.push({ role: "user", content: request.message });
    return { turn, history: history.slice(-MAX_SUPPORT_HISTORY), replay: false };
  });
}

export async function completeSupportTurn(turn: SupportTurn, answer: string, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const saved = await tx.supportTurn.updateMany({
      where: { id: turn.id, status: "PENDING", startedAt: turn.startedAt },
      data: { answer, status: "COMPLETE", completedAt: now },
    });
    if (!saved.count) throw new SupportChatError("This reply was interrupted. Please reload the chat.", 409);
    await tx.supportConversation.update({ where: { id: turn.conversationId }, data: { lastMessageAt: now } });
    return supportTurnView({ ...turn, answer, status: "COMPLETE", completedAt: now }, now);
  });
}

export async function failSupportTurn(turn: SupportTurn) {
  await prisma.supportTurn.updateMany({ where: { id: turn.id, status: "PENDING", startedAt: turn.startedAt },
    data: { status: "FAILED" } });
}
