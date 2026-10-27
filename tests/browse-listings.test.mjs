import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { parseBrowseParams } from "../lib/browseParams.ts";
import { convert } from "../lib/exchangeRates.ts";
import { assertBrowseTestDatabase, clearBrowseFixtures, seedBrowseFixtures } from "./fixtures/browse.mjs";

// Opt-in: never seed or migrate the app's configured database. Apply migrations
// to a local renew_browse_test DB, then set BROWSE_TEST_DATABASE_URL to run these.
describe("PostgreSQL browse queries", { skip: !process.env.BROWSE_TEST_DATABASE_URL }, () => {
  let prisma, getBrowseListings, fixtures;
  const rates = { USD: 1, EUR: 0.8, PHP: 50, JPY: 150 };
  const ids = (result) => result.listings.map((listing) => listing.id);
  before(async () => {
    assertBrowseTestDatabase(process.env.BROWSE_TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.BROWSE_TEST_DATABASE_URL;
    ({ prisma } = await import("../lib/prisma.ts"));
    ({ getBrowseListings } = await import("../lib/browseListings.ts"));
    fixtures = await seedBrowseFixtures(prisma);
  });
  after(async () => {
    if (prisma) {
      await clearBrowseFixtures(prisma);
      await prisma.$disconnect();
    }
  });

  async function check(params, rateMap = rates) {
    const state = parseBrowseParams(params);
    const price = (l) => convert(l.price, l.currency, state.currency, rateMap) ?? l.price;
    const terms = state.search.toLowerCase().split(/\s+/).filter(Boolean);
    const expected = fixtures.filter((l) => l.status === "ACTIVE"
      && (state.category === "all" || l.category === state.category)
      && terms.every((term) => `${l.title} ${l.spec}`.toLowerCase().includes(term))
      && (!state.grades.length || state.grades.includes(l.grade))
      && (!state.countries.length || state.countries.includes(l.location.split(", ").at(-1)))
      && (state.priceMin === null || price(l) >= state.priceMin)
      && (state.priceMax === null || price(l) <= state.priceMax)
      && l.wattageDraw <= state.maxWatt && (!state.verifiedOnly || l.aiVerified))
      .sort((a, b) => {
        const primary = state.sort === "price-asc" ? price(a) - price(b)
          : state.sort === "price-desc" ? price(b) - price(a)
          : state.sort === "bench-desc" ? b.benchmarkScore - a.benchmarkScore : 0;
        return primary || b.createdAt - a.createdAt || b.id.localeCompare(a.id);
      });
    const result = await getBrowseListings(state, rateMap);
    const page = Math.min(state.page, Math.max(1, Math.ceil(expected.length / 12)));
    assert.equal(result.totalMatching, expected.length);
    assert.equal(result.page, page);
    assert.deepEqual(ids(result), expected.slice((page - 1) * 12, page * 12).map((l) => l.id));
    return result;
  }

  test("returns complete, stable pages with bounded card data and excludes sold/over-watt listings", async () => {
    const pages = [];
    for (let page = 1; page <= 3; page++) pages.push(await check({ page: String(page) }));
    assert.deepEqual(pages.map((page) => page.listings.length), [12, 12, 8]);
    assert.equal(new Set(pages.flatMap(ids)).size, 32);
    for (const card of pages.flatMap((page) => page.listings)) {
      assert.equal(card.photos.length, 1);
      assert.equal(card.photos[0].url, "/demo/rtx-4090.jpg");
      assert.deepEqual(Object.keys(card.seller), ["name"]);
      for (const omitted of ["aiVerdict", "description", "benchmarkScore", "sellerId"]) assert.equal(omitted in card, false);
    }
    assert.deepEqual(ids(await check({ page: "999999999" })), ids(pages[2]));
    assert.deepEqual(ids(await check({})), ids(pages[0]));
  });

  test("combines filters before pagination and keeps zero-wattage listings", async () => {
    await check({ q: "fOuNdErS 16gb", category: "gpu", grade: ["A", "C"], country: ["Philippines", "United States"],
      minPrice: "0", maxPrice: "300", maxWatt: "350", verified: "1", sort: "price-desc" });
    const lowDraw = await check({ q: "RTX 0", maxWatt: "50" });
    assert.deepEqual(ids(lowDraw), ["browse-00"]);
    const empty = await check({ minPrice: "500", maxPrice: "100", page: "3" });
    assert.equal(empty.totalPages, 1);
    assert.equal(empty.page, 1);
  });

  test("search punctuation is literal and country matches the final comma-space component", async () => {
    for (const q of ["100%_proof", "O'Reilly", "\\", "Literal example"]) {
      assert.deepEqual(ids(await check({ q })), ["browse-literal"]);
    }
    assert.deepEqual(ids(await check({ country: "France" })), ["browse-literal"]);
    assert.equal((await check({ country: "Paris" })).totalMatching, 0);
    await check({ country: "United States" });
    await check({ q: "' OR 1=1 --" });
  });

  test("facet counts remain global/category-scoped rather than filtered or page-scoped", async () => {
    const result = await check({ category: "gpu", q: "missing", grade: "A", country: "France" });
    assert.equal(result.totalCount, 33);
    assert.deepEqual(result.categoryCounts, { GPU: 25, CPU: 6, OTHER: 2 });
    assert.deepEqual(result.gradeCounts, { A: 9, B: 8, C: 8 });
    assert.deepEqual(result.countryCounts, [
      { country: "Philippines", count: 9 }, { country: "Norway", count: 8 }, { country: "United States", count: 8 },
    ]);
  });

  test("all sorts and mixed-currency price bounds match displayed whole-unit conversions", async () => {
    for (const currency of ["USD", "EUR", "PHP", "JPY"]) {
      for (const sort of ["recent", "price-asc", "price-desc", "bench-desc"]) {
        await check({ currency, sort, page: "2" });
      }
      await check({ currency, minPrice: "1", maxPrice: "150", sort: "price-asc" });
    }
    for (const EUR of [0.49999999999999994, 0.5, 0.5000000000000001]) {
      await check({ q: "boundary", currency: "EUR", minPrice: "0", maxPrice: "0" }, { USD: 1, EUR });
      await check({ q: "boundary", currency: "EUR", minPrice: "1", maxPrice: "1" }, { USD: 1, EUR });
    }
  });

  test("missing, partial and USD-only rates preserve the raw-price fallback", async () => {
    for (const rateMap of [null, { USD: 1 }, { USD: 1, EUR: 0.8 }]) {
      for (const currency of ["USD", "EUR", "PHP"]) {
        await check({ currency, sort: "price-asc", maxPrice: "200" }, rateMap);
      }
    }
  });
});
