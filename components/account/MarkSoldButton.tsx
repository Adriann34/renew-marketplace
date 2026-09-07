"use client";
import { Button } from "@/components/ui/Button";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setListingStatusAction } from "@/app/listing/actions";

export function MarkSoldButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    startTransition(async () => {
      setError(null);
      const result = await setListingStatusAction(listingId, "SOLD");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex-1 min-w-0">
      <Button variant="secondary" size="small"
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="w-full"
      >
        {pending ? "Marking…" : "Mark sold"}
      </Button>
      {error && <p className="text-[11px] text-danger mt-1">{error}</p>}
    </div>
  );
}
