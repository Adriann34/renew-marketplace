"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleSaveAction } from "@/app/listing/actions";

export function ListingActions({
  listingId,
  initialSaved,
}: {
  listingId: string;
  initialSaved: boolean;
}) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);

  function toggleSave() {
    startTransition(async () => {
      const result = await toggleSaveAction(listingId);
      if ("error" in result) {
        router.push(`/signin?next=/listing/${listingId}`);
        return;
      }
      setLiked(result.saved);
    });
  }

  function share() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setShowToast(true);
    setTimeout(() => setShowToast(false), 1400);
  }

  return (
    <div className="flex gap-2 shrink-0 pt-1">
      <button
        type="button"
        onClick={toggleSave}
        disabled={pending}
        aria-pressed={liked}
        aria-label="Save listing"
        className={`ui-button ui-button-icon listing-save-button ${
          liked
            ? "listing-save-button-active"
            : "ui-button-secondary"
        }`}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 000-7.8z" />
        </svg>
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={share}
          aria-label="Share listing"
          className="ui-button ui-button-icon ui-button-secondary"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.6" y1="10.6" x2="15.4" y2="6.4" />
            <line x1="8.6" y1="13.4" x2="15.4" y2="17.6" />
          </svg>
        </button>
        <span
          role="status"
          aria-live="polite"
          className={`absolute -top-9 right-0 whitespace-nowrap bg-ink text-bg text-[11px] font-body px-2 py-1 rounded-xl transition-opacity ${
            showToast ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          {showToast ? "Link copied" : ""}
        </span>
      </div>
    </div>
  );
}
