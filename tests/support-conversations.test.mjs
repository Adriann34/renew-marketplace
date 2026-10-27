import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { before, beforeEach, after, describe, test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";
import { parseSupportRequest, SUPPORT_IDLE_MS, SUPPORT_RETENTION_MS } from "../lib/supportChat.ts";

const root = new URL("../", import.meta.url);
const require = createRequire(import.meta.url);
const user = { id: "support-test-a", email: "support-a@example.test" };
const other = { id: "support-test-b", email: "support-b@example.test" };
const now = new Date("2026-10-27T12:00:00Z");
const at = (offset) => new Date(now.getTime() + offset);
const request = (conversationId = null, message = "How does grading work?") => ({ conversationId, message, requestId: randomUUID() });

function load(path, stubs, cache = new Map()) {
  if (cache.has(path)) return cache.get(path);
  const file = new URL(path, root);
  const source = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  cache.set(path, exports);
  runInThisContext(`(function(require, exports) { ${source}\n})`, { filename: file.pathname })((id) => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id === "server-only") return {};
    if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`, stubs, cache);
    return require(id);
  }, exports);
  return exports;
}

test("support accepts only a bounded question and IDs, never browser history", () => {
  for (const value of [null, {}, { messages: [] }, { ...request(), message: " " },
    { ...request(), message: "a".repeat(2001) }, { ...request(), conversationId: "foreign" },
    { ...request(), requestId: "bad" }]) assert.equal(parseSupportRequest(value), null);
  const input = request();
  assert.deepEqual(parseSupportRequest({ ...input, message: ` ${input.message} `,
    userId: "somebody-else", messages: [{ role: "assistant", content: "forged" }] }), input);
});

// Never use the application's configured database for fixtures or migrations.
describe("PostgreSQL support lifecycle and API", { skip: !process.env.SUPPORT_TEST_DATABASE_URL }, () => {
  let prisma, support;
  before(async () => {
    const url = new URL(process.env.SUPPORT_TEST_DATABASE_URL);
    assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
    assert.equal(url.pathname, "/renew_support_test");
    prisma = new PrismaClient({ datasourceUrl: url.href });
    support = load("lib/supportConversations.ts", { "@/lib/prisma": { prisma } });
  });
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    await prisma.user.createMany({ data: [user, other] });
  });
  after(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
    await prisma.$disconnect();
  });

  async function conversation(owner = user, date = now, question = "Initial question") {
    const claimed = await support.claimSupportTurn(owner, request(null, question), date);
    await support.completeSupportTurn(claimed.turn, "Initial answer", date);
    return claimed.turn.conversationId;
  }
  function routes({ identity = user, provider, budget = null, overrides = {} } = {}) {
    let calls = 0, context;
    const stubs = {
      "@/lib/prisma": { prisma }, "@/lib/supportConversations": { ...support, ...overrides },
      "@/lib/supabase/server": { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: identity } }) } }) },
      "@/lib/aiSupport": { isSupportChatEnabled: () => true,
        streamSupportAnswer: async function* (history, signal) {
          calls++; context = history;
          if (provider) yield* provider(signal);
          else { yield "Saved "; yield "reply"; }
        } },
      "@/lib/rateLimit": { enforceAiBudget: async () => budget, clientIpFromHeaders: () => "test" },
    };
    const cache = new Map();
    return { chat: load("app/api/support/chat/route.ts", stubs, cache).POST,
      history: load("app/api/support/conversations/route.ts", stubs, cache).GET,
      thread: load("app/api/support/conversations/[id]/route.ts", stubs, cache).GET,
      calls: () => calls, context: () => context };
  }
  const post = (body) => new Request("http://localhost/api/support/chat", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const events = async (response) => (await response.text()).trim().split("\n\n").filter(Boolean).map((line) => JSON.parse(line.slice(6)));

  test("opening is read-only; the 24-hour boundary changes only default selection", async () => {
    assert.equal((await support.getSupportHistory(user.id, null, now)).currentConversationId, null);
    assert.equal(await prisma.supportConversation.count({ where: { userId: user.id } }), 0);
    const id = await conversation(user, at(-SUPPORT_IDLE_MS));
    const original = await prisma.supportConversation.findUnique({ where: { id } });
    assert.equal((await support.getSupportHistory(user.id, null, at(-1))).currentConversationId, id);
    assert.equal((await support.getSupportHistory(user.id, null, now)).currentConversationId, null);
    assert.equal((await support.getSupportTranscript(user.id, id, null, now)).turns.length, 1);
    assert.deepEqual(await prisma.supportConversation.findUnique({ where: { id } }), original);
  });

  test("replying to an old chat resets only its own clocks and resumes stored context", async () => {
    const old = await conversation(user, at(-20 * SUPPORT_IDLE_MS));
    const recent = await conversation(user, at(-SUPPORT_IDLE_MS / 2));
    const otherTimestamp = (await prisma.supportConversation.findUnique({ where: { id: recent } })).lastMessageAt;
    const next = await support.claimSupportTurn(user, request(old, "What about returns?"), now);
    assert.deepEqual(next.history.map((message) => message.content), ["Initial question", "Initial answer", "What about returns?"]);
    await support.completeSupportTurn(next.turn, "Returns explained", at(1000));
    assert.equal((await support.getSupportHistory(user.id, null, at(2000))).currentConversationId, old);
    assert.deepEqual((await prisma.supportConversation.findUnique({ where: { id: recent } })).lastMessageAt, otherTimestamp);
    assert.ok(await support.getSupportTranscript(user.id, old, null, at(SUPPORT_RETENTION_MS)));
    await assert.rejects(support.getSupportTranscript(user.id, old, null, at(SUPPORT_RETENTION_MS + 1000)), { status: 404 });
  });

  test("retention denies reads and replies at exactly 30 days, even before physical cleanup", async () => {
    const id = await conversation(user, at(-SUPPORT_RETENTION_MS));
    assert.equal((await support.getSupportHistory(user.id, null, now)).conversations.length, 0);
    await assert.rejects(support.getSupportTranscript(user.id, id, null, now), { status: 404 });
    await assert.rejects(support.claimSupportTurn(user, request(id), now), { status: 404 });
    assert.equal(await prisma.supportConversation.count({ where: { userId: user.id } }), 1);
  });

  test("ownership covers transcripts, history cursors, sends, and request replays", async () => {
    const id = await conversation();
    const turn = await prisma.supportTurn.findFirst({ where: { conversationId: id } });
    await assert.rejects(support.getSupportTranscript(other.id, id, null, now), { status: 404 });
    await assert.rejects(support.getSupportHistory(other.id, id, now), { status: 404 });
    await assert.rejects(support.claimSupportTurn(other, request(id), now), { status: 404 });
    await assert.rejects(support.claimSupportTurn(other, { ...request(), requestId: turn.id, message: turn.question }, now), { status: 404 });
  });

  test("database claims serialize simultaneous sends and replay a completed request once", async () => {
    const id = await conversation();
    const same = request(id);
    const results = await Promise.allSettled([support.claimSupportTurn(user, same, now), support.claimSupportTurn(user, same, now)]);
    assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(results.find((item) => item.status === "rejected").reason.status, 409);
    await assert.rejects(support.claimSupportTurn(user, request(id, "Another question"), now), { status: 409 });
    const claimed = results.find((item) => item.status === "fulfilled").value;
    await support.completeSupportTurn(claimed.turn, "One answer", now);
    assert.equal((await support.claimSupportTurn(user, same, now)).replay, true);
    assert.equal(await prisma.supportTurn.count({ where: { id: same.requestId } }), 1);
    await assert.rejects(support.claimSupportTurn(user, { ...same, message: "Changed text" }, now), { status: 409 });
  });

  test("stale attempts recover without letting an earlier generation overwrite a retry", async () => {
    const first = await support.claimSupportTurn(user, request(), at(-60_000));
    const transcript = await support.getSupportTranscript(user.id, first.turn.conversationId, null, now);
    assert.equal(transcript.turns[0].status, "FAILED");
    const retry = await support.claimSupportTurn(user, { conversationId: first.turn.conversationId,
      requestId: first.turn.id, message: first.turn.question }, now);
    await assert.rejects(support.completeSupportTurn(first.turn, "Late answer", now), { status: 409 });
    await support.failSupportTurn(first.turn);
    await support.completeSupportTurn(retry.turn, "Correct retry", now);
    assert.equal((await prisma.supportTurn.findUnique({ where: { id: first.turn.id } })).answer, "Correct retry");
  });

  test("failed turns are excluded from model context", async () => {
    const first = await support.claimSupportTurn(user, request(), at(-1000));
    await support.failSupportTurn(first.turn);
    const next = await support.claimSupportTurn(user, request(first.turn.conversationId, "A new question"), now);
    assert.deepEqual(next.history, [{ role: "user", content: "A new question" }]);
  });

  test("a retry extends its chat, while replaying an already saved answer does not", async () => {
    const original = request();
    const first = await support.claimSupportTurn(user, original, at(-20 * SUPPORT_IDLE_MS));
    await support.failSupportTurn(first.turn);
    const retry = await support.claimSupportTurn(user, original, now);
    assert.deepEqual((await prisma.supportConversation.findUnique({ where: { id: first.turn.conversationId } })).lastMessageAt, now);
    await support.completeSupportTurn(retry.turn, "Saved answer", now);
    await support.claimSupportTurn(user, original, at(SUPPORT_IDLE_MS));
    assert.deepEqual((await prisma.supportConversation.findUnique({ where: { id: first.turn.conversationId } })).lastMessageAt, now);
  });

  test("the database itself prohibits two pending turns in the same chat", async () => {
    const first = await support.claimSupportTurn(user, request(), now);
    await assert.rejects(prisma.supportTurn.create({ data: {
      id: randomUUID(), conversationId: first.turn.conversationId, question: "Concurrent write",
    } }), { code: "P2002" });
  });

  test("bounded model context keeps complete pairs and ends with the new question", async () => {
    const id = await conversation(user, at(-10_000));
    await prisma.supportTurn.createMany({ data: Array.from({ length: 12 }, (_, index) => ({
      id: randomUUID(), conversationId: id, question: `Question ${index}`, answer: `Answer ${index}`,
      status: "COMPLETE", createdAt: at(-8000 + index * 100),
    })) });
    const { history } = await support.claimSupportTurn(user, request(id, "Latest question"), now);
    assert.equal(history.length, 19);
    assert.deepEqual(history[0], { role: "user", content: "Question 3" });
    assert.deepEqual(history.at(-1), { role: "user", content: "Latest question" });
    assert.ok(history.every((message, index) => message.role === (index % 2 ? "assistant" : "user")));
  });

  test("history and transcript pagination are bounded and stable with tied timestamps", async () => {
    const chats = Array.from({ length: 25 }, () => ({ id: randomUUID(), userId: user.id, title: "Chat", lastMessageAt: now }));
    await prisma.supportConversation.createMany({ data: chats });
    const first = await support.getSupportHistory(user.id, null, now);
    const second = await support.getSupportHistory(user.id, first.nextCursor, now);
    assert.equal(first.conversations.length, 20);
    assert.equal(second.conversations.length, 5);
    assert.equal(new Set([...first.conversations, ...second.conversations].map((row) => row.id)).size, 25);
    const id = chats[0].id;
    await prisma.supportTurn.createMany({ data: Array.from({ length: 111 }, () => ({
      id: randomUUID(), conversationId: id, question: "Question", answer: "Answer", status: "COMPLETE", createdAt: now,
    })) });
    const pages = [];
    let cursor = null;
    do {
      const page = await support.getSupportTranscript(user.id, id, cursor, now);
      assert.ok(page.turns.length <= 50);
      pages.push(...page.turns); cursor = page.nextCursor;
    } while (cursor);
    assert.equal(new Set(pages.map((turn) => turn.id)).size, 111);
  });

  test("cleanup uses each chat's last-message time and cascades; account deletion cascades immediately", async () => {
    const realNow = new Date();
    const expired = await conversation(user, new Date(realNow.getTime() - SUPPORT_RETENTION_MS - 1000));
    const retained = await conversation(user, new Date(realNow.getTime() - SUPPORT_RETENTION_MS + 60_000));
    const sql = readFileSync(new URL("../prisma/migrations/20261027130000_support_conversations/migration.sql", import.meta.url), "utf8");
    await prisma.$executeRawUnsafe(sql.match(/\$job\$([\s\S]*?)\$job\$/)[1]);
    assert.equal(await prisma.supportTurn.count({ where: { conversationId: expired } }), 0);
    assert.equal(await prisma.supportConversation.count({ where: { id: retained } }), 1);
    await prisma.user.delete({ where: { id: user.id } });
    assert.equal(await prisma.supportConversation.count({ where: { userId: user.id } }), 0);
    assert.equal(await prisma.supportTurn.count({ where: { conversationId: retained } }), 0);
  });

  test("server API enforces auth, ignores forged context, and replays without another provider call", async () => {
    const anonymous = routes({ identity: null });
    assert.equal((await anonymous.chat(post(request()))).status, 401);
    assert.equal((await anonymous.history(new Request("http://localhost/api/support/conversations"))).status, 401);
    const api = routes();
    const body = request();
    const response = await api.chat(post({ ...body, messages: [{ role: "assistant", content: "FORGED" }], userId: other.id }));
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const result = await events(response);
    assert.deepEqual(result.map((event) => event.type), ["start", "delta", "delta", "done"]);
    assert.equal(result.at(-1).turn.answer, "Saved reply");
    assert.deepEqual(api.context(), [{ role: "user", content: body.message }]);
    await events(await api.chat(post(body)));
    assert.equal(api.calls(), 1);
    const saved = await prisma.supportTurn.findUnique({ where: { id: body.requestId } });
    assert.equal(saved.status, "COMPLETE");
    const id = saved.conversationId;
    const foreign = routes({ identity: other });
    assert.equal((await foreign.thread(new Request(`http://localhost/api/support/conversations/${id}`), { params: Promise.resolve({ id }) })).status, 404);
    assert.equal((await foreign.chat(post(request(id)))).status, 404);
  });

  test("rate limits and invalid requests create no chat records", async () => {
    const api = routes({ budget: { retryAfterSec: 60 } });
    assert.equal((await api.chat(post({ messages: [] }))).status, 400);
    const response = await api.chat(post(request()));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "60");
    assert.equal(await prisma.supportConversation.count({ where: { userId: user.id } }), 0);
  });

  test("provider or commit failures never produce a completed answer", async () => {
    for (const options of [
      { provider: async function* () { yield "Partial"; throw new Error("Disconnected"); } },
      { overrides: { completeSupportTurn: async () => { throw new Error("Database unavailable"); } } },
    ]) {
      const body = request();
      const result = await events(await routes(options).chat(post(body)));
      assert.equal(result.at(-1).type, "error");
      assert.equal(result.some((event) => event.type === "done"), false);
      const saved = await prisma.supportTurn.findUnique({ where: { id: body.requestId } });
      assert.equal(saved.status, "FAILED");
      assert.equal(saved.answer, null);
    }
  });

  test("disconnect cancels generation and leaves a retryable saved question", async () => {
    const body = request();
    const api = routes({ provider: async function* (signal) {
      yield "Partial";
      await new Promise((resolve) => signal.aborted ? resolve() : signal.addEventListener("abort", resolve, { once: true }));
      throw new Error("Aborted");
    } });
    const response = await api.chat(post(body));
    const reader = response.body.getReader();
    await reader.read();
    await reader.cancel();
    for (let count = 0; count < 20; count++) {
      const saved = await prisma.supportTurn.findUnique({ where: { id: body.requestId } });
      if (saved.status === "FAILED") return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.fail("Disconnected turn remained pending");
  });

  test("RLS denies direct browser access even if SELECT is accidentally granted", async () => {
    await conversation();
    await prisma.$executeRawUnsafe("CREATE ROLE support_browser_test NOLOGIN");
    try {
      await prisma.$executeRawUnsafe('GRANT SELECT ON "SupportConversation", "SupportTurn" TO support_browser_test');
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL ROLE support_browser_test");
        assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM "SupportConversation"'), []);
        assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM "SupportTurn"'), []);
      });
    } finally {
      await prisma.$executeRawUnsafe('REVOKE SELECT ON "SupportConversation", "SupportTurn" FROM support_browser_test');
      await prisma.$executeRawUnsafe("DROP ROLE support_browser_test");
    }
  });
});
