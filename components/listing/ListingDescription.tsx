"use client";

import { useEffect, useRef, useState } from "react";

// Collapse long descriptions behind a "Show more" toggle. Short descriptions
// that fit within the collapsed height render without any button.
export function ListingDescription({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  return (
    <div className="mb-6">
      <p className="text-[11px] text-ink-dim mb-2">Description</p>
      <p
        ref={ref}
        className={`text-[14px] text-ink whitespace-pre-wrap leading-relaxed ${
          expanded ? "" : "line-clamp-[10]"
        }`}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-[13px] font-medium text-accent hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
