import { PageShell } from "@/components/ui/Page";
import { BrowseView } from "@/components/browse/BrowseView";
import { getListings } from "@/lib/listings";
import { categoryOrder } from "@/lib/category";
import type { Category } from "@prisma/client";

function countBy<T extends string>(values: T[]): Partial<Record<T, number>> {
  const counts: Partial<Record<T, number>> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const listings = await getListings();
  const returnParams = new URLSearchParams();
  if (category) returnParams.set("category", category);
  if (q) returnParams.set("q", q);
  const returnTo = `/browse${returnParams.size ? `?${returnParams}` : ""}`;

  // Category tab counts are always totals across the whole dataset — the
  // sidebar's grade/location facet counts, by contrast, are scoped to the
  // selected tab and are computed client-side in BrowseView.
  const categoryCounts = countBy(listings.map((l) => l.category)) as Partial<Record<Category, number>>;

  const requestedCategory = category?.toUpperCase();
  const initialCategory =
    requestedCategory && categoryOrder.includes(requestedCategory as Category)
      ? (requestedCategory as Category)
      : "all";

  return (
    <PageShell className="browse-page">
      <BrowseView
        listings={listings}
        categoryOrder={categoryOrder}
        categoryCounts={categoryCounts}
        totalCount={listings.length}
        initialCategory={initialCategory}
        initialSearch={q ?? ""}
        returnTo={returnTo}
      />
    </PageShell>
  );
}
