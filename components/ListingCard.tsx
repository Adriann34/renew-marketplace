import Link from "next/link";
import { Price } from "@/components/Price";
import { gradeLabel } from "@/lib/grade";
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
      <div className="listing-image">
        {conditionPhoto ? (
          <img src={conditionPhoto.url} alt={listing.title} loading="lazy" decoding="async" />
        ) : (
          <div className="listing-image-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 9h6v6H9z" /></svg>
            <span>Photo not provided</span>
          </div>
        )}
        {listing.aiVerified && <span className="listing-verified"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3.5 8 3 3 6-6" /></svg>Photo verified</span>}
      </div>
      <div className="listing-content">
        <p className="listing-spec">{categoryLabels[listing.category]} <span aria-hidden="true">·</span> {listing.spec}</p>
        <h3>{listing.title}</h3>
        <div className="listing-price-row">
          <Price amount={listing.price} currency={listing.currency} className="listing-price" secondaryClassName="listing-original-price" />
          <span className="listing-condition">{gradeLabel[listing.grade]}</span>
        </div>
        <div className="listing-seller"><span>{listing.seller.name ?? "Seller"}</span><span>{listing.location}</span></div>
      </div>
    </Link>
  );
}
