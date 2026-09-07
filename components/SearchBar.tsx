"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// Global navbar search. It doesn't filter in place — on submit it sends the
// query to /browse, where BrowseView reads the `q` param and filters listings
// live. Keeping the actual filtering in one place (BrowseView) avoids two
// competing search implementations.
//
// On /browse itself the page already has its own prominent live-filtering
// search bar, so this global one would just be a redundant second box —
// hide it there and let the hero search own the experience.
export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/browse?q=${encodeURIComponent(trimmed)}` : "/browse");
  }

  if (pathname === "/browse") return null;

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="market-search"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search hardware…"
        aria-label="Search listings"
        className="min-w-0 flex-1 bg-transparent text-sm text-ink placeholder:text-ink-dim outline-none"
      />
    </form>
  );
}
