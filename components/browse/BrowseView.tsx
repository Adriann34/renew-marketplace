"use client";
import { PageHeading } from "@/components/ui/PageHeading";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category, Grade } from "@prisma/client";
import { ListingCard } from "@/components/ListingCard";
import { categoryLabels, categoryPluralLabels } from "@/lib/category";
import type { ListingWithRelations } from "@/lib/listings";
import { FilterSidebar } from "@/components/browse/FilterSidebar";
import { useCurrency } from "@/components/CurrencyProvider";

const PAGE_SIZE = 12;
const MAX_WATT = 500;

type SortKey = "recent" | "price-asc" | "price-desc" | "bench-desc";
type ViewMode = "grid" | "list";
type CategoryTab = Category | "all";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Sort: Recently verified",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "bench-desc": "Highest benchmark score",
};

export function BrowseView({
  listings,
  categoryOrder,
  categoryCounts,
  totalCount,
  initialCategory,
  initialSearch,
}: {
  listings: ListingWithRelations[];
  categoryOrder: Category[];
  categoryCounts: Partial<Record<Category, number>>;
  totalCount: number;
  initialCategory: CategoryTab;
  initialSearch: string;
}) {
  const { displayCurrency, toDisplay } = useCurrency();
  // Price filters/sorts operate in the viewer's display currency, so a listing
  // priced in ₱ and one in € compare on the same scale. If a rate is missing we
  // fall back to the raw number (best effort) rather than dropping the listing.
  const priceIn = useCallback(
    (l: ListingWithRelations) => toDisplay(l.price, l.currency) ?? l.price,
    [toDisplay]
  );

  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState<CategoryTab>(initialCategory);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [maxWatt, setMaxWatt] = useState(MAX_WATT);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);

  function toggleGrade(g: Grade) {
    setGrades((prev) => (prev.includes(g) ? prev.filter((v) => v !== g) : [...prev, g]));
  }

  function toggleCountry(c: string) {
    setCountries((prev) => (prev.includes(c) ? prev.filter((v) => v !== c) : [...prev, c]));
  }

  function clearFilters() {
    setGrades([]);
    setCountries([]);
    setPriceMin(null);
    setPriceMax(null);
    setMaxWatt(MAX_WATT);
    setVerifiedOnly(false);
  }

  // Sidebar facet counts (grade breakdown, location breakdown) are scoped to
  // the selected category tab, not the full dataset — otherwise switching to
  // a near-empty category (e.g. Motherboards) would still show grade/location
  // counts left over from every other category.
  const categoryScoped = useMemo(
    () => (category === "all" ? listings : listings.filter((l) => l.category === category)),
    [listings, category]
  );

  const gradeCounts = useMemo(() => {
    const counts: Partial<Record<Grade, number>> = {};
    for (const l of categoryScoped) counts[l.grade] = (counts[l.grade] ?? 0) + 1;
    return counts;
  }, [categoryScoped]);

  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of categoryScoped) {
      const country = l.location.split(", ").at(-1) ?? l.location;
      counts[country] = (counts[country] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count);
  }, [categoryScoped]);

  const filtered = useMemo(() => {
    // Match each whitespace-separated term against title + spec so a query like
    // "4090 founders" narrows rather than requiring the exact phrase.
    const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
    return listings.filter((l) => {
      if (terms.length) {
        const haystack = `${l.title} ${l.spec}`.toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      if (category !== "all" && l.category !== category) return false;
      if (grades.length && !grades.includes(l.grade)) return false;
      if (countries.length) {
        const country = l.location.split(", ").at(-1) ?? l.location;
        if (!countries.includes(country)) return false;
      }
      if (priceMin != null && priceIn(l) < priceMin) return false;
      if (priceMax != null && priceIn(l) > priceMax) return false;
      if (l.wattageDraw > 0 && l.wattageDraw > maxWatt) return false;
      if (verifiedOnly && !l.aiVerified) return false;
      return true;
    });
  }, [listings, search, category, grades, countries, priceMin, priceMax, maxWatt, verifiedOnly, priceIn]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "price-asc") arr.sort((a, b) => priceIn(a) - priceIn(b));
    else if (sort === "price-desc") arr.sort((a, b) => priceIn(b) - priceIn(a));
    else if (sort === "bench-desc") arr.sort((a, b) => b.benchmarkScore - a.benchmarkScore);
    else arr.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return arr;
  }, [filtered, sort, priceIn]);

  useEffect(() => {
    setPage(1);
  }, [search, category, grades, countries, priceMin, priceMax, maxWatt, verifiedOnly, sort]);

  // Price filter values are amounts in the display currency; when the viewer
  // switches currency those numbers would silently mean something else, so clear
  // them to avoid a misleading filter.
  useEffect(() => {
    setPriceMin(null);
    setPriceMax(null);
  }, [displayCurrency]);

  // A navbar search while already on /browse re-renders this component with a
  // new `q` param but doesn't remount it, so mirror the incoming value into
  // local state — otherwise the second search wouldn't take effect.
  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const categoryTotal = category === "all" ? totalCount : categoryCounts[category] ?? 0;
  const isSingular = categoryTotal === 1;
  const categoryLabel =
    category === "all"
      ? isSingular
        ? "listing"
        : "listings"
      : isSingular
        ? categoryLabels[category]
        : categoryPluralLabels[category];

  const sidebarProps = {
    gradeCounts,
    countryCounts,
    grades,
    countries,
    priceMin,
    priceMax,
    maxWatt,
    verifiedOnly,
    onToggleGrade: toggleGrade,
    onToggleCountry: toggleCountry,
    onPriceMinChange: setPriceMin,
    onPriceMaxChange: setPriceMax,
    onMaxWattChange: setMaxWatt,
    onToggleVerified: () => setVerifiedOnly((v) => !v),
    onClearAll: clearFilters,
  };

  return (
    <>
      <div className="browse-heading">
        <PageHeading eyebrow="The marketplace" title="Find your next build." description="Good hardware, ready for another chapter." />
        <div className="browse-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-dim shrink-0" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Renew"
            aria-label="Search listings"
            className="flex-1 bg-transparent px-2.5 text-[14px] text-ink placeholder:text-ink-dim outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="text-ink-dim hover:text-ink text-lg leading-none px-1"
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <div className="browse-categories">
          <CategoryTabButton
            active={category === "all"}
            label="All listings"
            count={totalCount}
            onClick={() => setCategory("all")}
          />
          {categoryOrder.map((c) => (
            <CategoryTabButton
              key={c}
              active={category === c}
              label={categoryPluralLabels[c]}
              count={categoryCounts[c] ?? 0}
              onClick={() => setCategory(c)}
            />
          ))}
        </div>
      </div>

      <div className="browse-layout">
        <Button variant="secondary" size="small"
          onClick={() => setFilterOpen(true)}
          className="browse-filter-trigger"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="10" y1="18" x2="14" y2="18" />
          </svg>
          Filters
        </Button>

        <aside className="hidden lg:block lg:w-56 lg:shrink-0 lg:sticky lg:top-28">
          <FilterSidebar {...sidebarProps} />
        </aside>

        {filterOpen && (
          <Dialog className="filter-dialog" label="Filter listings" onClose={() => setFilterOpen(false)}>
            <div className="relative w-[86%] max-w-sm h-full overflow-y-auto bg-bg p-6 rounded-l-3xl">
              <div className="flex items-center justify-between pb-4 border-b border-line mb-4">
                <p className="font-body text-[11px] text-accent">Filters</p>
                <Button variant="quiet" size="icon" onClick={() => setFilterOpen(false)} aria-label="Close filters">
                  ×
                </Button>
              </div>
              <FilterSidebar {...sidebarProps} />
            </div>
          </Dialog>
        )}

        <div className="min-w-0 w-full lg:flex-1">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p className="text-[14px] text-ink-dim">
              <b className="text-ink">{sorted.length}</b> of {categoryTotal} results
            </p>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Select
                  aria-label="Sort listings"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="ui-input-sort"
                >
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
                </Select>
                <svg
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 pointer-events-none text-ink-dim"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  title="Grid view"
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  onClick={() => setView("grid")}
                  className="segment flex items-center justify-center"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                  </svg>
                </button>
                <button
                  type="button"
                  title="List view"
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                  className="segment flex items-center justify-center"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {pageItems.length > 0 ? (
            <div
              className={view === "grid" ? "grid sm:grid-cols-2 xl:grid-cols-3 gap-6" : "flex flex-col gap-4"}
            >
              {pageItems.map((listing) => (
                <ListingCard key={listing.id} listing={listing} view={view} />
              ))}
            </div>
          ) : (
            <EmptyState title="No listings match those filters." action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}>
              Try widening the price range or clearing a filter — {categoryTotal}{" "}
              {categoryLabel.toLowerCase()} {isSingular ? "is" : "are"} waiting.
            </EmptyState>
          )}

          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} onChange={setPage} />
          )}
        </div>
      </div>
    </>
  );
}

function CategoryTabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`category-link shrink-0 ${active ? "category-link-all" : ""}`}
    >
      {label}
      <span className="tabular-nums text-[12px] text-ink-dim">{count}</span>
    </button>
  );
}

function Pagination({
  currentPage,
  totalPages,
  onChange,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  const pages = paginationRange(currentPage, totalPages);

  return (
    <div className="browse-pagination">
      <button
        type="button"
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onChange(currentPage - 1)}
        className="pagination-button"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`dots-${i}`} className="px-1 text-ink-dim">
            ···
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className="pagination-button"
            aria-label={`Page ${p}`}
            aria-current={p === currentPage ? "page" : undefined}
          >
            {p}
          </button>
        )
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={currentPage === totalPages}
        onClick={() => onChange(currentPage + 1)}
        className="pagination-button"
      >
        ›
      </button>
    </div>
  );
}

function paginationRange(current: number, total: number): (number | "…")[] {
  const pages: (number | "…")[] = [];
  const window = 1;
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - current) <= window) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }
  return pages;
}
