import assert from "node:assert/strict";

export const browseSellerId = "browse-test-seller";

export function assertBrowseTestDatabase(connection) {
  const url = new URL(connection);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Browse fixtures require a local database");
  assert.equal(url.pathname, "/renew_browse_test", "Browse fixtures require the dedicated renew_browse_test database");
}

export async function clearBrowseFixtures(prisma) {
  await prisma.listing.deleteMany({ where: { sellerId: browseSellerId } });
  await prisma.user.deleteMany({ where: { id: browseSellerId } });
}

export async function seedBrowseFixtures(prisma) {
  await clearBrowseFixtures(prisma);
  await prisma.user.create({ data: { id: browseSellerId, email: "browse-fixture@example.test", name: "Browse Seller", phone: "PRIVATE" } });
  const base = {
    sellerId: browseSellerId, title: "RTX Founders", category: "GPU", price: 100, currency: "USD",
    grade: "A", spec: "16GB GDDR6X", location: "Manila, Philippines", description: "Not needed on a card",
    benchmarkScore: 1000, benchmarkLabel: "Time Spy", wattageDraw: 150, aiVerified: true,
    aiVerdict: { internal: "Not needed on a card" }, createdAt: new Date("2026-01-01"), status: "ACTIVE",
  };
  const fixtures = Array.from({ length: 30 }, (_, i) => ({
    ...base, id: `browse-${String(i).padStart(2, "0")}`, title: `RTX ${i} Founders`,
    category: i < 24 ? "GPU" : "CPU", price: 100 + i * 10,
    currency: ["USD", "EUR", "PHP", "JPY"][i % 4], grade: ["A", "B", "C"][i % 3],
    location: ["Manila, Philippines", "Oslo, Norway", "United States"][i % 3],
    benchmarkScore: (i % 5) * 1000, wattageDraw: i === 0 ? 0 : 150 + i * 10, aiVerified: i % 2 === 0,
  }));
  fixtures.push(
    { ...base, id: "browse-boundary", category: "OTHER", title: "Rounding boundary", price: 1 },
    { ...base, id: "browse-literal", category: "OTHER", title: "Literal 100%_proof O'Reilly \\ example", location: "Region, Paris, France" },
    { ...base, id: "browse-high-watt", title: "High wattage", wattageDraw: 700 },
    { ...base, id: "browse-sold", title: "Sold Founders", status: "SOLD" },
  );
  for (const data of fixtures) {
    await prisma.listing.create({ data: {
      ...data,
      photos: { create: [
        { kind: "BENCHMARK", url: "/demo/rtx-3070.jpg", createdAt: new Date("2025-01-01") },
        { kind: "CONDITION", url: "/demo/rtx-4090.jpg", createdAt: new Date("2025-02-01") },
        { kind: "CONDITION", url: "/demo/rtx-3080ti.jpg", createdAt: new Date("2025-03-01") },
      ] },
    } });
  }
  return fixtures;
}
