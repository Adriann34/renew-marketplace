import assert from "node:assert/strict";
import { test } from "node:test";
import { browseUrl, parseBrowseParams, updateBrowseState } from "../lib/browseParams.ts";

test("browse params validate repeated and malformed values without throwing", () => {
  const state = parseBrowseParams({
    category: ["gpu", "cpu"], grade: ["A", "bad", "A", "C"], country: ["Norway", "Norway", ""],
    minPrice: "NaN", maxPrice: "Infinity", page: "9007199254740992", maxWatt: "-1",
    sort: "price; DROP TABLE", currency: "unknown", verified: "true",
  }, "PHP");
  assert.deepEqual(state, {
    search: "", category: "GPU", grades: ["A", "C"], countries: ["Norway"],
    priceMin: null, priceMax: null, maxWatt: 500, verifiedOnly: false,
    sort: "recent", page: 1, currency: "PHP",
  });
  for (const value of ["", " ", "-5", "NaN", "Infinity", "1e309"]) {
    assert.equal(parseBrowseParams({ minPrice: value }).priceMin, null);
  }
  for (const value of ["0", "-2", "1.5", "NaN"]) {
    assert.equal(parseBrowseParams({ page: value }).page, 1);
  }
  assert.equal(parseBrowseParams({}, "bad").currency, "USD");
});

test("browse URL round-trips all filters, literal punctuation, and price currency", () => {
  const state = parseBrowseParams({
    q: "  100%_proof O'Reilly \\  ", category: "GPU", grade: ["C", "A", "A"],
    country: ["United States", "Norway"], minPrice: "0", maxPrice: "1234.5",
    maxWatt: "250", verified: "1", sort: "price-asc", page: "3", currency: "EUR",
  });
  const url = new URL(browseUrl(state), "https://renew.test");
  assert.deepEqual(parseBrowseParams(url.searchParams, "PHP"), state);
  assert.equal(url.searchParams.get("currency"), "EUR");
  assert.equal(browseUrl(parseBrowseParams({})), "/browse?currency=USD");
});

test("input changes merge pending filters and reset pagination; currency clears only price bounds", () => {
  let state = parseBrowseParams({ page: "3", minPrice: "100", maxPrice: "500", currency: "USD" });
  state = updateBrowseState(state, { search: "founders" });
  state = updateBrowseState(state, { grades: ["A"] });
  assert.equal(state.search, "founders");
  assert.deepEqual(state.grades, ["A"]);
  assert.equal(state.page, 1);
  assert.equal(updateBrowseState(state, { page: 2 }).page, 2);
  const changed = updateBrowseState({ ...state, page: 3 }, { currency: "PHP" });
  assert.equal(changed.priceMin, null);
  assert.equal(changed.priceMax, null);
  assert.equal(changed.page, 1);
  assert.equal(changed.search, "founders");
  assert.deepEqual(changed.grades, ["A"]);
});
