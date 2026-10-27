import { Prisma, type Category, type Grade } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BROWSE_PAGE_SIZE, type BrowseState } from "@/lib/browseParams";
import { CURRENCY_CODES } from "@/lib/currency";
import type { Rates } from "@/lib/exchangeRates";

const CARD_SELECT = {
  id: true, title: true, category: true, spec: true, price: true,
  currency: true, grade: true, location: true, aiVerified: true,
  seller: { select: { name: true } },
  photos: {
    where: { kind: "CONDITION" },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 1,
    select: { url: true, kind: true, createdAt: true },
  },
} satisfies Prisma.ListingSelect;

export type BrowseListing = Prisma.ListingGetPayload<{ select: typeof CARD_SELECT }>;
type CountRow = { count: number };
const countrySql = Prisma.sql`split_part("location", ', ', -1)`;

// Match convert(): same currency short-circuits; unavailable rates use the raw
// amount; positive prices round to whole display units with JS number precision.
function displayPriceSql(currency: string, rates: Rates | null): Prisma.Sql {
  const targetRate = currency === "USD" ? 1 : rates?.[currency];
  if (!rates || !targetRate) return Prisma.sql`"price"`;
  const conversions = CURRENCY_CODES.filter((code) => code !== currency && (code === "USD" || rates[code]))
    .map((code) => {
      const value = Prisma.sql`(("price"::double precision / ${code === "USD" ? 1 : rates[code]}::double precision)
        * ${targetRate}::double precision)`;
      // Adding .5 can itself round a value just below a half upward. Compare
      // the fractional part instead, matching Math.round for positive prices.
      return Prisma.sql`WHEN "currency" = ${code} THEN
        floor(${value}) + CASE WHEN ${value} - floor(${value}) >= 0.5 THEN 1 ELSE 0 END`;
    });
  if (!conversions.length) return Prisma.sql`"price"`;
  return Prisma.sql`CASE ${Prisma.join(conversions, " ")} ELSE "price" END`;
}

export async function getBrowseListings(state: BrowseState, rates: Rates | null) {
  const displayPrice = displayPriceSql(state.currency, rates);
  const conditions: Prisma.Sql[] = [Prisma.sql`"status" = 'ACTIVE'`, Prisma.sql`"wattageDraw" <= ${state.maxWatt}`];
  if (state.category !== "all") conditions.push(Prisma.sql`"category" = ${state.category}::"Category"`);
  for (const term of state.search.toLowerCase().split(/\s+/).filter(Boolean)) {
    // strpos treats %, _, quotes and backslashes literally, just like includes().
    conditions.push(Prisma.sql`strpos(lower("title" || ' ' || "spec"), ${term}) > 0`);
  }
  if (state.grades.length) conditions.push(Prisma.sql`"grade"::text IN (${Prisma.join(state.grades)})`);
  if (state.countries.length) conditions.push(Prisma.sql`${countrySql} IN (${Prisma.join(state.countries)})`);
  if (state.priceMin !== null) conditions.push(Prisma.sql`${displayPrice} >= ${state.priceMin}`);
  if (state.priceMax !== null) conditions.push(Prisma.sql`${displayPrice} <= ${state.priceMax}`);
  if (state.verifiedOnly) conditions.push(Prisma.sql`"aiVerified" = true`);
  const where = Prisma.join(conditions, " AND ");
  const tieBreak = Prisma.sql`"createdAt" DESC, "id" DESC`;
  const order = state.sort === "price-asc" ? Prisma.sql`${displayPrice} ASC, ${tieBreak}`
    : state.sort === "price-desc" ? Prisma.sql`${displayPrice} DESC, ${tieBreak}`
    : state.sort === "bench-desc" ? Prisma.sql`"benchmarkScore" DESC, ${tieBreak}` : tieBreak;
  const categoryWhere: Prisma.ListingWhereInput = {
    status: "ACTIVE", ...(state.category === "all" ? {} : { category: state.category }),
  };
  const categoryCondition = state.category === "all" ? Prisma.empty
    : Prisma.sql`AND "category" = ${state.category}::"Category"`;

  // Counts, IDs and cards describe the same snapshot, even if a seller removes
  // a listing while this request is running. No full listing collection is loaded.
  return prisma.$transaction(async (tx) => {
    const [counts, categories, grades, countryCounts] = await Promise.all([
      tx.$queryRaw<CountRow[]>(Prisma.sql`SELECT count(*)::int AS count FROM "Listing" WHERE ${where}`),
      tx.listing.groupBy({ by: ["category"], where: { status: "ACTIVE" }, _count: { _all: true } }),
      tx.listing.groupBy({ by: ["grade"], where: categoryWhere, _count: { _all: true } }),
      tx.$queryRaw<({ country: string } & CountRow)[]>(Prisma.sql`
        SELECT ${countrySql} AS country, count(*)::int AS count FROM "Listing"
        WHERE "status" = 'ACTIVE' ${categoryCondition}
        GROUP BY ${countrySql} ORDER BY count DESC, country ASC`),
    ]);
    const totalMatching = counts[0].count;
    const totalPages = Math.max(1, Math.ceil(totalMatching / BROWSE_PAGE_SIZE));
    const page = Math.min(state.page, totalPages);
    const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id" FROM "Listing" WHERE ${where} ORDER BY ${order}
      LIMIT ${BROWSE_PAGE_SIZE} OFFSET ${(page - 1) * BROWSE_PAGE_SIZE}`);
    const cards = ids.length ? await tx.listing.findMany({
      where: { id: { in: ids.map(({ id }) => id) } }, select: CARD_SELECT,
    }) : [];
    const byId = new Map(cards.map((card) => [card.id, card]));
    return {
      listings: ids.map(({ id }) => byId.get(id)!),
      totalMatching, totalPages, page,
      totalCount: categories.reduce((sum, row) => sum + row._count._all, 0),
      categoryCounts: Object.fromEntries(categories.map((row) => [row.category, row._count._all])) as Partial<Record<Category, number>>,
      gradeCounts: Object.fromEntries(grades.map((row) => [row.grade, row._count._all])) as Partial<Record<Grade, number>>,
      countryCounts,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export type BrowseResults = Awaited<ReturnType<typeof getBrowseListings>>;
