"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export function ListingBackLink({
  href,
  restoreHistory,
}: {
  href: string;
  restoreHistory: boolean;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (
          restoreHistory &&
          window.history.length > 1 &&
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          router.back();
        }
      }}
      className="inline-flex items-center gap-2 text-[13px] text-ink-dim hover:text-ink transition-colors"
    >
      ← Back to listings
    </Link>
  );
}
