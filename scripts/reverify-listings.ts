/** One-time active-listing recheck. Preview: npm run verify:existing
 * Apply after deployment: npm run verify:existing -- --apply
 */
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { Prisma, type Listing, type ListingPhoto } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAiVerificationEnabled, verifyListingClaims, PHOTO_KIND_LABEL, type AiImageInput } from "@/lib/aiVerify";
import { enforceAiBudget } from "@/lib/rateLimit";

type ListingWithPhotos = Listing & { photos: ListingPhoto[] };
const photosQuery = { photos: { orderBy: { id: "asc" as const } } };

function claims(listing: Listing) {
  const { title, category, grade, spec, description, benchmarkLabel, benchmarkScore, wattageDraw, bootVerified } = listing;
  return { title, category, grade, spec, description, benchmarkLabel, benchmarkScore, wattageDraw, bootVerified };
}

function snapshot(listing: ListingWithPhotos) {
  return JSON.stringify({
    claims: claims(listing), status: listing.status, checkedAt: listing.aiCheckedAt,
    photos: listing.photos.map(({ id, kind, url }) => ({ id, kind, url })),
  });
}

async function loadImages(photos: ListingPhoto[]): Promise<AiImageInput[]> {
  const images: AiImageInput[] = [];
  for (const photo of photos) {
    let buffer: Buffer;
    if (photo.url.startsWith("/demo/")) {
      const path = resolve("public", `.${photo.url}`);
      if (!path.startsWith(resolve("public/demo") + sep)) throw new Error("Invalid demo path");
      buffer = await readFile(path);
    } else {
      if (!photo.url.startsWith("https://")) throw new Error("Unsupported photo URL");
      const response = await fetch(photo.url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("Photo unavailable");
      buffer = Buffer.from(await response.arrayBuffer());
    }
    images.push({ label: PHOTO_KIND_LABEL[photo.kind], kind: photo.kind, buffer });
  }
  return images;
}

export async function reverifyListings(apply = false) {
  if (apply && !isAiVerificationEnabled()) throw new Error("GEMINI_API_KEY is required to apply rechecks.");
  // The repair migration cleared timestamps. Every saved verdict sets one,
  // including partial/unverified/flagged results, so retries skip completed work.
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", aiCheckedAt: null }, include: photosQuery, orderBy: { id: "asc" },
  });
  const summary = { verified: 0, partial: 0, unverified: 0, flagged: 0, failed: 0, skipped: 0 };
  console.log(`${apply ? "Rechecking" : "Previewing"} ${listings.length} active listings awaiting verification.`);
  for (const listing of listings) {
    if (!apply) {
      console.log(`${listing.id}: ${listing.photos.length} photos`);
      continue;
    }
    try {
      if (await enforceAiBudget(listing.sellerId, "admin:reverify")) {
        summary.skipped++;
        console.log(`${listing.id}: skipped (AI budget unavailable)`);
        continue;
      }
      const result = await verifyListingClaims(claims(listing), await loadImages(listing.photos));
      const saved = await prisma.$transaction(async (tx) => {
        const current = await tx.listing.findUnique({ where: { id: listing.id }, include: photosQuery });
        if (!current || snapshot(current) !== snapshot(listing)) return false;
        await tx.listing.update({
          where: { id: listing.id },
          data: result
            ? { aiVerified: result.verified, aiVerdict: result as unknown as Prisma.InputJsonValue, aiCheckedAt: new Date() }
            : { aiVerified: false, aiVerdict: Prisma.DbNull, aiCheckedAt: null },
        });
        return true;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      if (!saved) {
        summary.skipped++;
        console.log(`${listing.id}: skipped (listing changed during check)`);
      } else if (result) {
        summary[result.status]++;
        console.log(`${listing.id}: ${result.status}`);
      } else {
        summary.failed++;
        console.log(`${listing.id}: check unavailable; verification cleared`);
      }
    } catch {
      summary.failed++;
      console.log(`${listing.id}: failed to load evidence or save the check`);
    }
  }
  console.log(apply ? JSON.stringify(summary) : "Preview only; no AI calls or writes. Apply with --apply after deployment.");
  return summary;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply")) {
    console.error("Usage: npm run verify:existing -- [--apply]");
    process.exitCode = 1;
  } else {
    reverifyListings(args.includes("--apply"))
      .then((summary) => { if (summary.failed || summary.skipped) process.exitCode = 1; })
      .catch(() => {
        console.error("Rechecks could not start. Check database access and GEMINI_API_KEY.");
        process.exitCode = 1;
      })
      .finally(() => prisma.$disconnect());
  }
}
