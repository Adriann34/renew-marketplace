import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { afterEach, beforeEach, test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();

// Exercise the real server helpers without Next.js's server-only import guard.
function loadServerModule(name) {
  if (modules.has(name)) return modules.get(name);
  const path = new URL(`../lib/${name}.ts`, import.meta.url);
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  runInThisContext(`(function(require, exports) { ${source}\n})`, { filename: path.pathname })(
    (id) => id === "server-only" ? {} : id.startsWith("@/lib/") ? loadServerModule(id.slice(6)) : require(id),
    exports,
  );
  modules.set(name, exports);
  return exports;
}

const { streamSupportAnswer } = loadServerModule("aiSupport");
const { verifyListingClaims, autofillDiagnostics } = loadServerModule("aiVerify");
const images = [{ label: "Condition", kind: "CONDITION", buffer: readFileSync(new URL("../public/demo/rtx-4090.jpg", import.meta.url)) }];
const claims = {
  title: "RTX 4090", category: "GPU", grade: "A", spec: "24GB", description: "Excellent condition",
  benchmarkLabel: "", benchmarkScore: 0, wattageDraw: 0, bootVerified: false,
};
const originalKey = process.env.GEMINI_API_KEY;

beforeEach(() => { process.env.GEMINI_API_KEY = "test-key"; });
afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

function inspectRequest(url, init, method) {
  const endpoint = new URL(url);
  assert.equal(endpoint.origin, "https://generativelanguage.googleapis.com");
  assert.equal(endpoint.pathname, `/v1beta/models/gemini-flash-lite-latest:${method}`);
  assert.equal(init.method, "POST");
  const body = JSON.parse(init.body);
  for (const name of ["temperature", "top_p", "top_k", "topP", "topK"]) {
    assert.equal(Object.hasOwn(body.generationConfig, name), false);
  }
  return body;
}

test("support uses Flash-Lite latest and parses streamed text across chunk boundaries", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = inspectRequest(url, init, "streamGenerateContent");
    assert.equal(new URL(url).searchParams.get("alt"), "sse");
    assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: "How does grading work?" }] }]);
    assert.equal(body.generationConfig.maxOutputTokens, 800);
    assert.ok(body.systemInstruction.parts[0].text.includes("KNOWLEDGE BASE:"));
    const event = (text) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\r\n\r\n`;
    const data = event("Grade A ") + event("means excellent condition.");
    return new Response(new ReadableStream({ start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(data.slice(0, 23)));
      controller.enqueue(encoder.encode(data.slice(23)));
      controller.close();
    } }));
  });
  const chunks = [];
  for await (const chunk of streamSupportAnswer([{ role: "user", content: "How does grading work?" }])) chunks.push(chunk);
  assert.equal(chunks.join(""), "Grade A means excellent condition.");
  assert.equal(fetch.mock.callCount(), 1);
});

test("photo verification uses Flash-Lite latest with image input and structured JSON", async (t) => {
  const verdict = {
    summary: "The condition photo supports grade A.", confidence: 0.95,
    claims: [{ dimension: "condition", field: "grade", claimed: "A", observed: "Excellent condition", status: "match", confidence: 0.95, note: "No visible wear." }],
  };
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = inspectRequest(url, init, "generateContent");
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(body.generationConfig.responseSchema.properties.claims);
    assert.equal(body.contents[0].parts.at(-1).inline_data.mime_type, "image/webp");
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(verdict) }] } }] });
  });
  const result = await verifyListingClaims(claims, images);
  assert.equal(result.model, "gemini-flash-lite-latest");
  assert.equal(result.summary, verdict.summary);
  assert.deepEqual(result.claims, verdict.claims);
  assert.equal(result.score, 0.25);
  assert.equal(fetch.mock.callCount(), 1);
});

test("diagnostic autofill uses Flash-Lite latest and parses structured JSON", async (t) => {
  const diagnostics = { grade: "A", benchmarkLabel: "Time Spy", benchmarkScore: 12345, wattageDraw: 300, bootVerified: true };
  const fetch = t.mock.method(globalThis, "fetch", async (url, init) => {
    const body = inspectRequest(url, init, "generateContent");
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.ok(body.generationConfig.responseSchema.properties.grade);
    assert.equal(body.contents[0].parts.at(-1).inline_data.mime_type, "image/webp");
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(diagnostics) }] } }] });
  });
  assert.deepEqual(await autofillDiagnostics(images), diagnostics);
  assert.equal(fetch.mock.callCount(), 1);
});

test("all AI features preserve their fallback when the provider fails", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
  const chunks = [];
  for await (const chunk of streamSupportAnswer([{ role: "user", content: "Hello" }])) chunks.push(chunk);
  assert.deepEqual(chunks, []);
  assert.equal(await verifyListingClaims(claims, images), null);
  assert.equal(await autofillDiagnostics(images), null);
});

test("all AI features skip provider requests when no API key is configured", async (t) => {
  delete process.env.GEMINI_API_KEY;
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected provider request"); });
  const chunks = [];
  for await (const chunk of streamSupportAnswer([{ role: "user", content: "Hello" }])) chunks.push(chunk);
  assert.deepEqual(chunks, []);
  assert.equal(await verifyListingClaims(claims, images), null);
  assert.equal(await autofillDiagnostics(images), null);
  assert.equal(fetch.mock.callCount(), 0);
});

test("durable support rejects a truncated stream even after receiving text", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response(
    `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Partial answer" }] } }] })}\n\n`,
  ));
  const chunks = [];
  await assert.rejects(async () => {
    for await (const chunk of streamSupportAnswer([{ role: "user", content: "Hello" }], undefined, { requireComplete: true })) chunks.push(chunk);
  }, /Incomplete support response/);
  assert.deepEqual(chunks, ["Partial answer"]);
});

test("durable support accepts a finish marker split across network chunks", async (t) => {
  const payload = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Complete answer" }] }, finishReason: "STOP" }] })}\n\n`;
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({ start(controller) {
    const encoder = new TextEncoder();
    controller.enqueue(encoder.encode(payload.slice(0, -8)));
    controller.enqueue(encoder.encode(payload.slice(-8)));
    controller.close();
  } })));
  const chunks = [];
  for await (const chunk of streamSupportAnswer([{ role: "user", content: "Hello" }], undefined, { requireComplete: true })) chunks.push(chunk);
  assert.equal(chunks.join(""), "Complete answer");
});

test("durable support rejects malformed events instead of saving missing text", async (t) => {
  t.mock.method(globalThis, "fetch", async () => new Response('data: {broken}\n\n'));
  await assert.rejects(async () => {
    for await (const chunk of streamSupportAnswer([{ role: "user", content: "Hello" }], undefined, { requireComplete: true })) void chunk;
  }, /Invalid support response/);
});
