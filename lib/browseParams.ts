import type { Category, Grade } from "@prisma/client";
import { categoryFromSlug } from "@/lib/category";
import { DEFAULT_CURRENCY, isSupportedCurrency } from "@/lib/currency";

export const BROWSE_PAGE_SIZE = 12;
export const BROWSE_MAX_WATT = 500;
export type BrowseSort = "recent" | "price-asc" | "price-desc" | "bench-desc";
export type BrowseParams = Record<string, string | string[] | undefined>;

export type BrowseState = {
  search: string;
  category: Category | "all";
  grades: Grade[];
  countries: string[];
  priceMin: number | null;
  priceMax: number | null;
  maxWatt: number;
  verifiedOnly: boolean;
  sort: BrowseSort;
  page: number;
  currency: string;
};

export function parseBrowseParams(
  params: BrowseParams | URLSearchParams,
  defaultCurrency = DEFAULT_CURRENCY,
): BrowseState {
  const values = (key: string): string[] => {
    if (params instanceof URLSearchParams) return params.getAll(key);
    const value = params[key];
    return Array.isArray(value) ? value : value === undefined ? [] : [value];
  };
  const first = (key: string) => values(key)[0] ?? "";
  const price = (key: string) => {
    const value = first(key);
    const number = Number(value);
    return value.trim() && Number.isFinite(number) && number >= 0 && number <= Number.MAX_SAFE_INTEGER
      ? number : null;
  };
  const page = Number(first("page"));
  const watt = Number(first("maxWatt"));
  const sort = first("sort");
  const currency = first("currency");
  return {
    search: first("q").trim(),
    category: categoryFromSlug(first("category")) ?? "all",
    grades: [...new Set(values("grade"))].filter((g): g is Grade => g === "A" || g === "B" || g === "C").sort(),
    countries: [...new Set(values("country").filter((c) => c.length > 0 && c.length <= 120))].sort(),
    priceMin: price("minPrice"),
    priceMax: price("maxPrice"),
    maxWatt: Number.isFinite(watt) && watt >= 50 && watt <= BROWSE_MAX_WATT
      ? Math.round(watt / 10) * 10 : BROWSE_MAX_WATT,
    verifiedOnly: first("verified") === "1",
    sort: sort === "price-asc" || sort === "price-desc" || sort === "bench-desc" ? sort : "recent",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    currency: isSupportedCurrency(currency) ? currency
      : isSupportedCurrency(defaultCurrency) ? defaultCurrency : DEFAULT_CURRENCY,
  };
}

export function browseUrl(state: BrowseState): string {
  const params = new URLSearchParams();
  if (state.search.trim()) params.set("q", state.search.trim());
  if (state.category !== "all") params.set("category", state.category.toLowerCase());
  for (const grade of [...new Set(state.grades)].sort()) params.append("grade", grade);
  for (const country of [...new Set(state.countries)].sort()) params.append("country", country);
  if (state.priceMin !== null) params.set("minPrice", String(state.priceMin));
  if (state.priceMax !== null) params.set("maxPrice", String(state.priceMax));
  if (state.maxWatt !== BROWSE_MAX_WATT) params.set("maxWatt", String(state.maxWatt));
  if (state.verifiedOnly) params.set("verified", "1");
  if (state.sort !== "recent") params.set("sort", state.sort);
  if (state.page > 1) params.set("page", String(state.page));
  // Currency is context, rather than an optional filter: shared price bounds
  // must retain their units even when opened by someone with another preference.
  params.set("currency", state.currency);
  return `/browse?${params}`;
}

export function updateBrowseState(state: BrowseState, patch: Partial<BrowseState>): BrowseState {
  const next = { ...state, ...patch, page: patch.page ?? 1 };
  if (patch.currency && patch.currency !== state.currency) {
    next.priceMin = null;
    next.priceMax = null;
    next.page = 1;
  }
  return next;
}
