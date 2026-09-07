"use client";
import { Button } from "@/components/ui/Button";

import { useState, useTransition } from "react";
import { deleteListingAction } from "@/app/listing/actions";

export function DeleteListingButton({
  listingId,
  iconOnly,
}: {
  listingId: string;
  /** Compact trash-icon trigger instead of the full "Delete listing" button — same confirm flow either way. */
  iconOnly?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      setError(null);
      // On success the action redirects (throws NEXT_REDIRECT), so control
      // only returns here when it hands back an error object.
      const result = await deleteListingAction(listingId);
      if (result?.error) setError(result.error);
    });
  }

  if (!confirming) {
    if (iconOnly) {
      return (
        <Button variant="danger-outline" size="icon"
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Delete listing"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          </svg>
        </Button>
      );
    }
    return (
      <Button variant="danger-outline" size="small"
        type="button"
        onClick={() => setConfirming(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
        </svg>
        Delete listing
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[12px] text-ink-dim">
        {error ?? "Delete this listing permanently?"}
      </span>
      <Button variant="danger"
        type="button"
        onClick={handleDelete}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button variant="secondary" size="small"
        type="button"
        onClick={() => {
          setConfirming(false);
          setError(null);
        }}
        disabled={pending}
      >
        Cancel
      </Button>
    </div>
  );
}
