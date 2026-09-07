"use client";
import { Button } from "@/components/ui/Button";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startConversationAction } from "@/app/messages/actions";

export function MessageSellerButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await startConversationAction(listingId);
      if ("error" in result) {
        if (result.error === "unauthenticated") {
          router.push(`/signin?next=/listing/${listingId}`);
        } else {
          setError(result.error);
        }
        return;
      }
      router.push(`/messages/${result.id}`);
    });
  }

  return (
    <div className="shrink-0 flex flex-col items-end gap-1">
      <Button variant="secondary" size="small"
        type="button"
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Opening…" : "Message seller"}
      </Button>
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
