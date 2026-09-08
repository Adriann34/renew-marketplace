import { notFound } from "next/navigation";
import { PageShell } from "@/components/ui/Page";
import { ButtonLink } from "@/components/ui/Button";
import { DiagnosticTag } from "@/components/DiagnosticTag";
import { ListingGallery, type GalleryGroup } from "@/components/listing/ListingGallery";
import { ListingActions } from "@/components/listing/ListingActions";
import { DeleteListingButton } from "@/components/listing/DeleteListingButton";
import { MessageSellerButton } from "@/components/listing/MessageSellerButton";
import { BuyNowButton } from "@/components/listing/BuyNowButton";
import { ListingDescription } from "@/components/listing/ListingDescription";
import { AiVerdictPanel } from "@/components/listing/AiVerdictPanel";
import { getListingById } from "@/lib/listings";
import { parseAiVerdict } from "@/lib/aiVerify";
import { isListingSaved } from "@/lib/saved";
import { createClient } from "@/lib/supabase/server";
import { Price } from "@/components/Price";
import { ListingBackLink } from "@/components/listing/ListingBackLink";
import { isSafeInternalPath, safeInternalPath } from "@/lib/navigation";
import type { PhotoKind } from "@prisma/client";

const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  CONDITION: "Condition",
  BURN_IN: "Burn-in test",
  BENCHMARK: "Benchmark",
  BOOT: "Boot / POST",
};

const PHOTO_KIND_ORDER: PhotoKind[] = ["CONDITION", "BURN_IN", "BENCHMARK", "BOOT"];

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const returnTo = safeInternalPath(from, "/browse");
  const restoreHistory = isSafeInternalPath(from);
  const listingPath = `/listing/${id}?from=${encodeURIComponent(returnTo)}`;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const aiVerdict = parseAiVerdict(listing.aiVerdict);

  const groups: GalleryGroup[] = PHOTO_KIND_ORDER.map((kind) => ({
    kind,
    label: PHOTO_KIND_LABELS[kind],
    photos: listing.photos.filter((p) => p.kind === kind),
  })).filter((group) => group.photos.length > 0);

  const proofCount = groups.length;
  const sellerLabel = listing.seller.name ?? "Seller";
  const initials = sellerLabel.slice(0, 2).toUpperCase();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = !!user && user.id === listing.sellerId;
  const initialSaved = user ? await isListingSaved(user.id, listing.id) : false;

  return (
    <PageShell>

      <div className="mb-8">
        <ListingBackLink href={returnTo} restoreHistory={restoreHistory} />
      </div>

      <div className="listing-detail">
        <div className="min-w-0 space-y-8">
          <ListingGallery groups={groups} title={listing.title} />

          <div className="flex items-center gap-3 border-t border-line pt-6">
            <div className="avatar w-11 h-11">
              {listing.seller.avatarUrl ? (
                <img src={listing.seller.avatarUrl} alt={sellerLabel} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium truncate">{sellerLabel}</p>
              <p className="text-[12px] text-ink-dim truncate">{listing.location}</p>
            </div>
            {!isOwner && <MessageSellerButton listingId={listing.id} listingPath={listingPath} />}
          </div>

          {listing.description && (
            <div className="border-t border-line pt-6">
              <ListingDescription text={listing.description} />
            </div>
          )}
        </div>

        <div className="listing-summary">
          {isOwner && (
            <div className="flex items-center justify-between gap-3 flex-wrap border-b border-line pb-5 mb-6">
              <span className="text-[12px] text-ink-dim">This is your listing.</span>
              <div className="flex items-center gap-2">
                <ButtonLink
                  href={`/listing/${listing.id}/edit?from=${encodeURIComponent(returnTo)}`}
                  variant="secondary" size="small"
                >
                  Edit
                </ButtonLink>
                <DeleteListingButton listingId={listing.id} />
              </div>
            </div>
          )}

          {!isOwner && listing.status === "SOLD" && (
            <div className="form-notice mb-6">
              <span className="text-[12px] text-ink-dim">
                This listing has been marked as sold and is no longer available.
              </span>
            </div>
          )}

          <p className="text-[11px] text-ink-dim mb-1">
            {listing.category} · {listing.spec}
          </p>

          <div className="flex items-start justify-between gap-4">
            <h1 className="listing-title">
              {listing.title}
            </h1>
            <ListingActions listingId={listing.id} initialSaved={initialSaved} listingPath={listingPath} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-5 mb-6">
            <Price amount={listing.price} currency={listing.currency} className="listing-price-detail" />
            {listing.aiVerified && (
              <span className="inline-flex items-center gap-1.5 border border-pass text-pass bg-pass/10 text-[11px] font-medium px-2.5 py-1 rounded-xl">
                ✓ Verified
              </span>
            )}
          </div>

          <div className="mb-4">
            <DiagnosticTag
              grade={listing.grade}
              benchmarkScore={listing.benchmarkScore}
              benchmarkLabel={listing.benchmarkLabel}
              wattageDraw={listing.wattageDraw}
              bootVerified={listing.bootVerified}
            />
          </div>

          <div className="proof-summary">
            {PHOTO_KIND_ORDER.map((kind) => {
              const has = groups.some((g) => g.kind === kind);
              return (
                <span
                  key={kind}
                  className={`inline-flex items-center gap-1.5 text-[12px] ${
                    has ? "text-ink" : "text-ink-dim/50"
                  }`}
                >
                  <span className={has ? "text-pass" : ""}>{has ? "✓" : "–"}</span>
                  {PHOTO_KIND_LABELS[kind]}
                </span>
              );
            })}
            <span className="ml-auto font-body text-[11px] text-ink-dim">
              {proofCount}/4 proofs attached
            </span>
          </div>

          {!isOwner && (
            <div className="mb-6">
              <BuyNowButton listingId={listing.id} listingPath={listingPath} />
            </div>
          )}

          {aiVerdict && <AiVerdictPanel result={aiVerdict} />}
        </div>
      </div>

    </PageShell>
  );
}
