"use client";
import { PageHeading } from "@/components/ui/PageHeading";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Grade } from "@prisma/client";
import { ListingCard } from "@/components/ListingCard";
import { categoryOrder, categoryPluralLabels } from "@/lib/category";
import type { BrowseResults } from "@/lib/browseListings";
import { BROWSE_MAX_WATT, browseUrl, parseBrowseParams, updateBrowseState, type BrowseSort, type BrowseState } from "@/lib/browseParams";
import { FilterSidebar } from "@/components/browse/FilterSidebar";
import { useCurrency } from "@/components/CurrencyProvider";

type ViewMode = "grid" | "list";

const SORT_LABELS: Record<BrowseSort, string> = {
  recent: "Sort: Recently verified",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "bench-desc": "Highest benchmark score",
};

export function BrowseView({ state, results, returnTo }: {
  state: BrowseState;
  results: BrowseResults;
  returnTo: string;
}) {
  const router = useRouter();
  const { displayCurrency } = useCurrency();
  const [draft, setDraft] = useState(state);
  const draftRef = useRef(state);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = useRef<string | null>(null);
  const [debouncing, setDebouncing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<ViewMode>("grid");
  const [filterOpen, setFilterOpen] = useState(false);
  const { listings: pageItems, categoryCounts, totalCount, totalMatching, totalPages,
    page: currentPage, gradeCounts, countryCounts } = results;
  const { search, category, grades, countries, priceMin, priceMax, maxWatt, verifiedOnly, sort } = draft;
  const busy = pending || debouncing || browseUrl(draft) !== returnTo;
  const requestedUrl = returnTo;
  const previousRequest = useRef(requestedUrl);
  const syncedState = useRef(state);

  useEffect(() => {
    // Initial hydration and local input renders already have the right state.
    if (syncedState.current === state && previousRequest.current === requestedUrl) return;
    // An older response must not overwrite input typed while it was in flight.
    const expectedUrl = browseUrl({ ...draftRef.current, page: Math.min(draftRef.current.page, results.totalPages) });
    if (target.current && target.current !== requestedUrl && expectedUrl !== requestedUrl) return;
    if (previousRequest.current !== requestedUrl && target.current !== requestedUrl) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setDebouncing(false);
    }
    previousRequest.current = requestedUrl;
    target.current = null;
    if (timer.current) return;
    syncedState.current = state;
    const synced = {
      ...state,
      search: draftRef.current.search.trim() === state.search ? draftRef.current.search : state.search,
    };
    draftRef.current = synced;
    setDraft(synced);
  }, [state, requestedUrl, results.totalPages]);

  useEffect(() => {
    function restore() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      target.current = null;
      setDebouncing(false);
      const restored = parseBrowseParams(new URLSearchParams(window.location.search), displayCurrency);
      draftRef.current = restored;
      setDraft(restored);
    }
    window.addEventListener("popstate", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [displayCurrency]);

  useEffect(() => {
    // Cancel before Link starts fetching: a queued search must not navigate
    // back to browse while a listing or another category is opening.
    function cancelForLink(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.origin !== window.location.origin || link.hasAttribute("download") ||
        (link.target && link.target !== "_self")) return;
      if (link.hash && link.pathname === window.location.pathname && link.search === window.location.search) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      target.current = null;
      setDebouncing(false);
      draftRef.current = state;
      setDraft(state);
    }
    document.addEventListener("click", cancelForLink, true);
    return () => document.removeEventListener("click", cancelForLink, true);
  }, [state]);

  function navigate(next: BrowseState, replace: boolean) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDebouncing(false);
    const normalized = parseBrowseParams(new URL(browseUrl(next), window.location.origin).searchParams, next.currency);
    const nextDraft = { ...normalized, search: next.search };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    const url = browseUrl(normalized);
    target.current = url;
    startTransition(() => {
      if (replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    });
  }

  function update(patch: Partial<BrowseState>, continuous = false) {
    const next = updateBrowseState(draftRef.current, patch);
    draftRef.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    if (continuous) {
      setDebouncing(true);
      timer.current = setTimeout(() => navigate(draftRef.current, true), 250);
    } else navigate(next, false);
  }

  // Currency changes cannot reinterpret existing price bounds as another unit.
  const previousCurrency = useRef(displayCurrency);
  useEffect(() => {
    if (previousCurrency.current === displayCurrency) return;
    previousCurrency.current = displayCurrency;
    const next = updateBrowseState(draftRef.current, { currency: displayCurrency });
    draftRef.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setDebouncing(false);
    target.current = browseUrl(next);
    startTransition(() => router.replace(browseUrl(next), { scroll: false }));
  }, [displayCurrency, router]);

  function toggleGrade(g: Grade) {
    const current = draftRef.current.grades;
    update({ grades: current.includes(g) ? current.filter((v) => v !== g) : [...current, g] });
  }

  function toggleCountry(c: string) {
    const current = draftRef.current.countries;
    update({ countries: current.includes(c) ? current.filter((v) => v !== c) : [...current, c] });
  }

  function clearFilters() {
    update({ grades: [], countries: [], priceMin: null, priceMax: null, maxWatt: BROWSE_MAX_WATT, verifiedOnly: false });
  }

  const categoryTotal = state.category === "all" ? totalCount : categoryCounts[state.category] ?? 0;

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
    onPriceMinChange: (value: number | null) => update({ priceMin: value }, true),
    onPriceMaxChange: (value: number | null) => update({ priceMax: value }, true),
    onMaxWattChange: (value: number) => update({ maxWatt: value }, true),
    onToggleVerified: () => update({ verifiedOnly: !draftRef.current.verifiedOnly }),
    onClearAll: clearFilters,
  };

  return (
    <>
      <div className="browse-heading">
        <PageHeading title="Browse Listings" />
        <div className="browse-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-dim shrink-0" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input
            type="search"
            value={search}
            onChange={(e) => update({ search: e.target.value }, true)}
            placeholder="Search Renew"
            aria-label="Search listings"
            className="flex-1 bg-transparent px-2.5 text-[14px] text-ink placeholder:text-ink-dim outline-none [&::-webkit-search-cancel-button]:appearance-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => update({ search: "" })}
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
            onClick={() => update({ category: "all" })}
          />
          {categoryOrder.map((c) => (
            <CategoryTabButton
              key={c}
              active={category === c}
              label={categoryPluralLabels[c]}
              count={categoryCounts[c] ?? 0}
              onClick={() => update({ category: c })}
            />
          ))}
        </div>
      </div>

      <div className="browse-layout" aria-busy={busy}>
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
            <p className="text-[14px] text-ink-dim" role="status" aria-live="polite">
              <b className="text-ink">{totalMatching}</b> of {categoryTotal} results
              {busy && <span className="ml-2 text-[12px]">Updating…</span>}
            </p>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <Select
                  aria-label="Sort listings"
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value as BrowseSort })}
                  className="ui-input-sort"
                >
                  {(Object.keys(SORT_LABELS) as BrowseSort[]).map((key) => (
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
                <ListingCard key={listing.id} listing={listing} view={view} returnTo={returnTo} />
              ))}
            </div>
          ) : (
            <EmptyState title="No matching listings" action={<Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}>
              Try adjusting your filters.
            </EmptyState>
          )}

          {totalPages > 1 && (
            <Pagination currentPage={currentPage} totalPages={totalPages} disabled={busy} onChange={(page) => update({ page })} />
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
  disabled,
}: {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
  disabled: boolean;
}) {
  const pages = paginationRange(currentPage, totalPages);

  return (
    <div className="browse-pagination">
      <button
        type="button"
        aria-label="Previous page"
        disabled={disabled || currentPage === 1}
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
            disabled={disabled}
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
        disabled={disabled || currentPage === totalPages}
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
  const candidates = [...new Set([1, current - 1, current, current + 1, total])]
    .filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  for (const p of candidates) {
    const previous = pages.at(-1);
    if (typeof previous === "number" && p > previous + 1) pages.push("…");
    pages.push(p);
  }
  return pages;
}
