"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/Button";
import { toggleSaveAction } from "@/app/listing/actions";
import type { ListingWithRelations } from "@/lib/listings";

export function SavedListingCard({ listing }: { listing: ListingWithRelations }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function handleRemove() {
    startTransition(async () => {
      setError(null);
      const result = await toggleSaveAction(listing.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="min-w-0">
      <ListingCard listing={listing} returnTo="/account?tab=saved" />
      <div className="saved-listing-actions">
        <Button variant="quiet" size="small" className="w-full" onClick={handleRemove} disabled={pending}>
          {pending ? "Removing…" : "Remove from saved"}
        </Button>
        {error && <p role="alert" className="text-[12px] text-danger mt-2">{error}</p>}
      </div>
    </div>
  );
}
