import Link from "next/link";
import { ListingImage } from "@/components/listing/ListingImage";
import { ConditionBadge } from "@/components/ConditionBadge";
import { DeleteListingButton } from "@/components/listing/DeleteListingButton";
import { MarkSoldButton } from "@/components/account/MarkSoldButton";
import { ButtonLink } from "@/components/ui/Button";
import { Price } from "@/components/Price";
import { categoryLabels } from "@/lib/category";
import type { ListingWithSaveCount } from "@/lib/listings";

export function ManageListingCard({ listing }: { listing: ListingWithSaveCount }) {
  const conditionPhoto = listing.photos.filter((p) => p.kind === "CONDITION").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const isSold = listing.status === "SOLD";

  return <article className="manage-row">
    <Link href={`/listing/${listing.id}`} aria-label={`View ${listing.title}`}><ListingImage src={conditionPhoto?.url} title={listing.title} /></Link>
    <div className="min-w-0">
      <p className="listing-spec">{categoryLabels[listing.category]} · {listing.spec}</p>
      <h3><Link href={`/listing/${listing.id}`}>{listing.title}</Link></h3>
      <div className="manage-row-meta">
        <Price amount={listing.price} currency={listing.currency} className="text-[17px] font-medium" />
        <ConditionBadge grade={listing.grade} />
        <span className="status-badge"><span className={`w-1.5 h-1.5 rounded-full ${isSold ? "bg-ink-dim" : "bg-pass"}`} />{isSold ? "Sold" : "Active"}</span>
      </div>
      <p className="text-[12px] text-ink-dim mt-3">{listing._count.savedBy} saved · Listed {new Date(listing.createdAt).toLocaleDateString()}</p>
    </div>
    <div className="manage-row-actions">
      <ButtonLink href={`/listing/${listing.id}/edit`} variant="secondary" size="small">Edit listing</ButtonLink>
      {!isSold && <MarkSoldButton listingId={listing.id} />}
      <DeleteListingButton listingId={listing.id} />
    </div>
  </article>;
}
