import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const scriptPath = new URL("../scripts/reverify-listings.ts", import.meta.url);
const require = createRequire(scriptPath);
const source = ts.transpileModule(readFileSync(scriptPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const loadScript = runInThisContext(`(function(require, exports, module, console, fetch) { ${source}\n})`);

function harness({ enabled = true, budget = null, result = { status: "verified", verified: true }, change, failPhoto = false, failSave = false } = {}) {
  const listing = {
    id: "listing-a", sellerId: "seller-a", status: "ACTIVE", aiCheckedAt: null,
    title: "Part", category: "GPU", grade: "A", spec: "10GB", description: "Description",
    benchmarkLabel: "Time Spy", benchmarkScore: 10000, wattageDraw: 250, bootVerified: true,
    photos: [
      { id: "a", kind: "CONDITION", url: "/demo/test.jpg" },
      { id: "b", kind: "BENCHMARK", url: "https://example.supabase.co/proof.jpg" },
    ],
  };
  const current = structuredClone(listing);
  if (change) change(current);
  const readFile = mock.fn(async () => Buffer.from("demo"));
  const fetch = mock.fn(async () => ({ ok: !failPhoto, arrayBuffer: async () => new Uint8Array([1, 2]).buffer }));
  const verify = mock.fn(async () => result);
  const aiBudget = mock.fn(async () => budget);
  const update = mock.fn(async () => { if (failSave) throw new Error("serialization failure"); });
  const findUnique = mock.fn(async () => current);
  const prisma = {
    listing: { findMany: mock.fn(async () => [listing]) },
    $transaction: mock.fn(async (callback) => callback({ listing: { findUnique, update } })),
  };
  const stubs = {
    "node:fs/promises": { readFile },
    "@/lib/prisma": { prisma },
    "@/lib/aiVerify": {
      isAiVerificationEnabled: () => enabled, verifyListingClaims: verify,
      PHOTO_KIND_LABEL: { CONDITION: "Condition", BENCHMARK: "Benchmark screenshot" },
    },
    "@/lib/rateLimit": { enforceAiBudget: aiBudget },
  };
  const exports = {};
  loadScript((id) => Object.hasOwn(stubs, id) ? stubs[id] : require(id), exports, {}, { log() {} }, fetch);
  return { run: exports.reverifyListings, listing, prisma, update, findUnique, readFile, fetch, verify, aiBudget };
}

test("preview selects active listings without AI, photo fetches, budgets, or writes", async () => {
  const h = harness({ enabled: false });
  await h.run();
  assert.deepEqual(h.prisma.listing.findMany.mock.calls[0].arguments[0].where, { status: "ACTIVE", aiCheckedAt: null });
  for (const fn of [h.prisma.$transaction, h.fetch, h.readFile, h.aiBudget, h.verify]) assert.equal(fn.mock.callCount(), 0);
});

test("apply requires configured AI before accessing the database", async () => {
  const h = harness({ enabled: false });
  await assert.rejects(h.run(true), /GEMINI_API_KEY/);
  assert.equal(h.prisma.listing.findMany.mock.callCount(), 0);
});

for (const result of [{ status: "verified", verified: true }, { status: "partial", verified: false }, { status: "unverified", verified: false }, { status: "flagged", verified: false }, null]) {
  test(`recheck saves fresh verdict or clears unavailable result: ${JSON.stringify(result)}`, async () => {
    const h = harness({ result });
    const summary = await h.run(true);
    assert.equal(h.readFile.mock.callCount(), 1);
    assert.equal(h.fetch.mock.callCount(), 1);
    assert.ok(h.fetch.mock.calls[0].arguments[1].signal instanceof AbortSignal);
    assert.deepEqual(h.verify.mock.calls[0].arguments[1].map((image) => image.buffer), [Buffer.from("demo"), Buffer.from([1, 2])]);
    assert.deepEqual(h.aiBudget.mock.calls[0].arguments, ["seller-a", "admin:reverify"]);
    assert.equal(h.prisma.$transaction.mock.calls[0].arguments[1].isolationLevel, "Serializable");
    const data = h.update.mock.calls[0].arguments[0].data;
    assert.equal(data.aiVerified, result?.verified ?? false);
    if (result) {
      assert.deepEqual(data.aiVerdict, result);
      assert.ok(data.aiCheckedAt instanceof Date);
      assert.equal(summary[result.status], 1);
    } else {
      assert.equal(data.aiVerdict, require("@prisma/client").Prisma.DbNull);
      assert.equal(data.aiCheckedAt, null);
      assert.equal(summary.failed, 1);
    }
  });
}

for (const [name, change] of [
  ["claims", (listing) => { listing.title = "Different part"; }],
  ["photos", (listing) => { listing.photos[0].url = "/demo/different.jpg"; }],
  ["status", (listing) => { listing.status = "SOLD"; }],
  ["newer verdict", (listing) => { listing.aiCheckedAt = new Date(); }],
]) {
  test(`recheck skips concurrent changes to ${name}`, async () => {
    const h = harness({ change });
    assert.equal((await h.run(true)).skipped, 1);
    assert.equal(h.update.mock.callCount(), 0);
  });
}

test("budget denial skips photo loading and verification", async () => {
  const h = harness({ budget: { allowed: false } });
  assert.equal((await h.run(true)).skipped, 1);
  for (const fn of [h.fetch, h.readFile, h.verify, h.update]) assert.equal(fn.mock.callCount(), 0);
});

for (const options of [{ failPhoto: true }, { failSave: true }]) {
  test(`failed evidence or save is reported: ${JSON.stringify(options)}`, async () => {
    const h = harness(options);
    assert.equal((await h.run(true)).failed, 1);
    if (options.failPhoto) {
      assert.equal(h.verify.mock.callCount(), 0);
      assert.equal(h.update.mock.callCount(), 0);
    }
  });
}

test("demo photo paths cannot read outside public/demo", async () => {
  const h = harness();
  h.listing.photos[0].url = "/demo/../../.env";
  assert.equal((await h.run(true)).failed, 1);
  assert.equal(h.readFile.mock.callCount(), 0);
});

test("reruns progress past a 15-listing budget and stop checking completed listings", async () => {
  const h = harness();
  const listings = Array.from({ length: 16 }, (_, index) => ({
    ...structuredClone(h.listing), id: `listing-${String(index).padStart(2, "0")}`,
  }));
  h.prisma.listing.findMany.mock.mockImplementation(async ({ where }) => listings
    .filter((listing) => listing.status === where.status &&
      (!Object.hasOwn(where, "aiCheckedAt") || listing.aiCheckedAt === where.aiCheckedAt))
    .map((listing) => structuredClone(listing)));
  h.findUnique.mock.mockImplementation(async ({ where }) => structuredClone(listings.find((listing) => listing.id === where.id)));
  h.update.mock.mockImplementation(async ({ where, data }) => Object.assign(listings.find((listing) => listing.id === where.id), data));
  let remaining = 15;
  h.aiBudget.mock.mockImplementation(async () => remaining-- > 0 ? null : { allowed: false });

  const first = await h.run(true);
  assert.equal(first.verified, 15);
  assert.equal(first.skipped, 1);
  remaining = 15; // The next budget window.
  const second = await h.run(true);
  assert.equal(second.verified, 1);
  assert.equal(second.skipped, 0);
  assert.equal(h.verify.mock.callCount(), 16);
  const budgetCalls = h.aiBudget.mock.callCount();
  await h.run(true);
  assert.equal(h.verify.mock.callCount(), 16);
  assert.equal(h.aiBudget.mock.callCount(), budgetCalls);
});
