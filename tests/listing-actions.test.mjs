import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const actionPath = new URL("../app/listing/actions.ts", import.meta.url);
const require = createRequire(actionPath);
// Load the real action without starting Next.js or connecting to external services.
const source = ts.transpileModule(readFileSync(actionPath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loadAction = runInThisContext(`(function(require, exports) { ${source}\n})`, {
  filename: actionPath.pathname,
});

function harness({ user = { id: "seller-a" }, sellerId = "seller-a", failSave = false,
  aiEnabled = true, overBudget = true, aiResult = null, listingFields = {} } = {}) {
  const photo = (id, listingId, kind = "CONDITION") => ({
    id, listingId, kind,
    url: `https://example.supabase.co/storage/v1/object/public/listing-photos/${listingId}/${id}.webp`,
  });
  let photos = [
    { ...photo("condition-a", "listing-a"), url: "/demo/condition.webp" },
    photo("detail-a", "listing-a", "BENCHMARK"),
    photo("photo-b", "listing-b"),
    photo("same-seller-photo", "another-owned-listing"),
  ];
  const originalPhotos = structuredClone(photos);
  const listing = {
    id: "listing-a", sellerId, category: "OTHER", title: "Test part",
    price: 10, currency: "USD", grade: "A", spec: "Part", location: "Manila",
    description: "Test description", bootVerified: false, benchmarkLabel: "",
    benchmarkScore: 0, wattageDraw: 0,
    aiVerified: true, aiVerdict: { status: "verified" }, aiCheckedAt: new Date("2026-01-01"),
    ...listingFields,
    photos: photos.filter((p) => p.listingId === "listing-a"),
  };
  const redirectError = new Error("redirect");
  const remove = mock.fn(async () => ({ error: null }));
  const upload = mock.fn(async (_supabase, listingId, kind) => ({
    kind, path: `${listingId}/new.webp`, url: `/demo/new.webp`,
  }));
  const aiBudget = mock.fn(async () => overBudget);
  const verify = mock.fn(async () => aiResult);
  const prisma = {
    listing: {
      findUnique: mock.fn(async () => listing),
      update: mock.fn((args) => ({ type: "update", ...args })),
    },
    listingPhoto: { deleteMany: mock.fn((args) => ({ type: "delete", ...args })) },
    $transaction: mock.fn(async (operations) => {
      let nextPhotos = [...photos];
      for (const op of operations) {
        if (op.type === "delete") {
          nextPhotos = nextPhotos.filter((p) => !(
            op.where.id.in.includes(p.id) &&
            (op.where.listingId === undefined || op.where.listingId === p.listingId)
          ));
        } else {
          if (failSave) throw new Error("Database unavailable");
          nextPhotos.push(...op.data.photos.create.map((p) => ({ ...p, id: "new-photo", listingId: op.where.id })));
        }
      }
      photos = nextPhotos;
    }),
  };
  const stubs = {
    "next/navigation": { redirect: () => { throw redirectError; } },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/supabase/server": {
      createClient: async () => ({
        auth: { getUser: async () => ({ data: { user } }) },
        storage: { from: () => ({ remove }) },
      }),
    },
    "@/lib/prisma": { prisma },
    "@/lib/photoUpload": { ...require("@/lib/photoUpload"), uploadPhoto: upload },
    "@/lib/aiVerify": {
      isAiVerificationEnabled: () => aiEnabled, verifyListingClaims: verify,
      PHOTO_KIND_LABEL: { CONDITION: "Condition", BENCHMARK: "Benchmark screenshot" },
    },
    "@/lib/rateLimit": {
      enforceUploadBudget: async () => false,
      enforceAiBudget: aiBudget,
      clientIp: async () => "127.0.0.1",
    },
  };
  const actions = {};
  loadAction((id) => Object.hasOwn(stubs, id) ? stubs[id] : require(id), actions);

  async function save(ids = [], { replacement = false, fields = {} } = {}) {
    const form = new FormData();
    for (const field of ["id", "category", "title", "price", "currency", "grade", "spec", "location", "description", "benchmarkLabel", "benchmarkScore", "wattageDraw"]) {
      form.set(field, String(listing[field]));
    }
    form.set("bootVerified", listing.bootVerified ? "on" : "");
    for (const [key, value] of Object.entries(fields)) form.set(key, String(value));
    for (const id of ids) form.append("removedPhotoIds", id);
    if (replacement) form.append("photos_condition", new File(["image"], "photo.png", { type: "image/png" }));
    try {
      return await actions.updateListingAction({ error: null }, form);
    } catch (error) {
      if (error !== redirectError) throw error;
      return { redirected: true };
    }
  }
  return { save, prisma, remove, upload, aiBudget, verify, originalPhotos, photos: () => photos };
}

function assertCleared(h) {
  const data = h.prisma.listing.update.mock.calls[0].arguments[0].data;
  assert.equal(data.aiVerified, false);
  assert.equal(data.aiVerdict, require("@prisma/client").Prisma.DbNull);
  assert.equal(data.aiCheckedAt, null);
}

for (const [field, value] of Object.entries({
  title: "Different part", spec: "Different spec", grade: "B", description: "New description",
  benchmarkLabel: "Another benchmark", benchmarkScore: 12000, wattageDraw: 300, bootVerified: "",
})) {
  for (const aiEnabled of [true, false]) {
    test(`${field} changes clear verification with AI ${aiEnabled ? "over budget" : "disabled"}`, async () => {
      const h = harness({ aiEnabled, listingFields: {
        category: "GPU", benchmarkLabel: "Time Spy", benchmarkScore: 10000, wattageDraw: 250, bootVerified: true,
      } });
      assert.deepEqual(await h.save([], { fields: { [field]: value } }), { redirected: true });
      assertCleared(h);
      assert.equal(h.aiBudget.mock.callCount(), aiEnabled ? 1 : 0);
      assert.equal(h.verify.mock.callCount(), 0);
    });
  }
}

for (const options of [{}, { fields: { price: 20 } }, { fields: { currency: "PHP" } }, { fields: { location: "Oslo" } }]) {
  test(`unrelated edits preserve verification: ${JSON.stringify(options)}`, async () => {
    const h = harness();
    await h.save([], options);
    const data = h.prisma.listing.update.mock.calls[0].arguments[0].data;
    for (const field of ["aiVerified", "aiVerdict", "aiCheckedAt"]) assert.equal(Object.hasOwn(data, field), false);
    assert.equal(h.aiBudget.mock.callCount(), 0);
  });
}

for (const [ids, options] of [[["detail-a"], {}], [[], { replacement: true }]]) {
  test(`photo changes clear verification with AI disabled: ${JSON.stringify({ ids, options })}`, async () => {
    const h = harness({ aiEnabled: false });
    await h.save(ids, options);
    assertCleared(h);
    assert.equal(h.aiBudget.mock.callCount(), 0);
  });
}

for (const result of [null, { verified: true, status: "verified" }, { verified: false, status: "flagged" }]) {
  test(`changed claims save the fresh AI result or clear a failed check: ${JSON.stringify(result)}`, async () => {
    const h = harness({ overBudget: false, aiResult: result });
    // Remove the only remote photo so the real gatherer uses the new upload without network access.
    await h.save(["detail-a"], { replacement: true, fields: { title: "New title", spec: "New spec" } });
    assert.equal(h.verify.mock.callCount(), 1);
    const [claims, images] = h.verify.mock.calls[0].arguments;
    assert.equal(claims.title, "New title");
    assert.equal(claims.spec, "New spec");
    assert.equal(images.length, 1);
    const data = h.prisma.listing.update.mock.calls[0].arguments[0].data;
    if (result) {
      assert.equal(data.aiVerified, result.verified);
      assert.deepEqual(data.aiVerdict, result);
      assert.ok(data.aiCheckedAt instanceof Date);
    } else assertCleared(h);
  });
}

for (const [name, ids] of [
  ["another seller's photo", ["photo-b"]],
  ["another listing owned by the same seller", ["same-seller-photo"]],
  ["unknown, empty, and duplicate foreign IDs", ["unknown", "", "photo-b", "photo-b"]],
  ["an unchanged photo set", []],
]) {
  test(`saving ignores ${name} without deleting photos or spending AI budget`, async () => {
    const h = harness();
    assert.deepEqual(await h.save(ids), { redirected: true });
    assert.deepEqual(h.photos(), h.originalPhotos);
    assert.equal(h.prisma.listingPhoto.deleteMany.mock.callCount(), 0);
    assert.equal(h.remove.mock.callCount(), 0);
    assert.equal(h.aiBudget.mock.callCount(), 0);
  });
}

for (const ids of [["detail-a"], ["detail-a", "photo-b", "same-seller-photo", "unknown", "detail-a"]]) {
  test(`removes only a matching photo of the edited listing: ${ids.join(", ")}`, async () => {
    const h = harness();
    assert.deepEqual(await h.save(ids), { redirected: true });
    assert.deepEqual(h.prisma.listingPhoto.deleteMany.mock.calls[0].arguments, [{
      where: { listingId: "listing-a", id: { in: ["detail-a"] } },
    }]);
    assert.deepEqual(h.photos(), h.originalPhotos.filter((p) => p.id !== "detail-a"));
    assert.deepEqual(h.remove.mock.calls[0].arguments, [["listing-a/detail-a.webp"]]);
    assert.equal(h.remove.mock.callCount(), 1);
    assert.equal(h.aiBudget.mock.callCount(), 1);
  });
}

for (const [name, options, message] of [
  ["signed-out users", { user: null }, "You must be signed in to edit a listing."],
  ["other sellers", { sellerId: "seller-b" }, "You can only edit your own listings."],
]) {
  test(`rejects edits by ${name} before writing or removing photos`, async () => {
    const h = harness(options);
    assert.deepEqual(await h.save(["detail-a"]), { error: message });
    assert.equal(h.prisma.$transaction.mock.callCount(), 0);
    assert.equal(h.remove.mock.callCount(), 0);
    assert.deepEqual(h.photos(), h.originalPhotos);
  });
}

test("rejects removing the final condition photo without a replacement", async () => {
  const h = harness();
  assert.deepEqual(await h.save(["condition-a", "photo-b"]), {
    error: "A listing needs at least one condition photo.",
  });
  assert.equal(h.prisma.$transaction.mock.callCount(), 0);
  assert.equal(h.remove.mock.callCount(), 0);
});

test("allows replacing the final condition photo and leaves other listings intact", async () => {
  const h = harness();
  assert.deepEqual(await h.save(["condition-a", "photo-b"], { replacement: true }), { redirected: true });
  assert.equal(h.upload.mock.callCount(), 1);
  assert.deepEqual(h.photos().map((p) => p.id), ["detail-a", "photo-b", "same-seller-photo", "new-photo"]);
  assert.equal(h.photos().at(-1).kind, "CONDITION");
  assert.equal(h.remove.mock.callCount(), 0); // The removed seed photo has no storage object.
});

test("a failed save preserves existing photos and cleans up only the new upload", async () => {
  const h = harness({ failSave: true });
  assert.deepEqual(await h.save(["detail-a", "photo-b"], { replacement: true }), {
    error: "Failed to save changes. Please try again.",
  });
  assert.deepEqual(h.photos(), h.originalPhotos);
  assert.deepEqual(h.remove.mock.calls[0].arguments, [["listing-a/new.webp"]]);
  assert.equal(h.remove.mock.callCount(), 1);
});
