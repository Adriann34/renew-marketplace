import Link from "next/link";
import { Price } from "@/components/Price";
import { ConditionBadge } from "@/components/ConditionBadge";
import { ListingImage } from "@/components/listing/ListingImage";
import { categoryLabels } from "@/lib/category";
import type { ListingWithRelations } from "@/lib/listings";

export function ListingCard({ listing, view = "grid" }: {
  listing: ListingWithRelations;
  view?: "grid" | "list";
}) {
  const conditionPhoto = listing.photos
    .filter((photo) => photo.kind === "CONDITION")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

  return (
    <Link href={`/listing/${listing.id}`} className={`market-listing-card${view === "list" ? " market-listing-card-list" : ""}`}>
      <ListingImage src={conditionPhoto?.url} title={listing.title} verified={listing.aiVerified} />
      <div className="listing-content">
        <p className="listing-spec">{categoryLabels[listing.category]} <span aria-hidden="true">·</span> {listing.spec}</p>
        <h3>{listing.title}</h3>
        <div className="listing-price-row">
          <Price amount={listing.price} currency={listing.currency} className="listing-price" secondaryClassName="listing-original-price" />
          <ConditionBadge grade={listing.grade} />
        </div>
        <div className="listing-seller"><span>{listing.seller.name ?? "Seller"}</span><span>{listing.location}</span></div>
      </div>
    </Link>
  );
}
