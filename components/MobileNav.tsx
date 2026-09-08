"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function MobileNav({ children }: { children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!disclosure.current?.contains(event.target as Node)) {
        disclosure.current?.removeAttribute("open");
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, []);

  return (
    <details
      ref={disclosure}
      className="mobile-nav"
      onKeyDown={(event) => {
        if (event.key === "Escape" && disclosure.current?.open) {
          disclosure.current.open = false;
          disclosure.current.querySelector("summary")?.focus();
        }
      }}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node) &&
          disclosure.current
        ) {
          disclosure.current.open = false;
        }
      }}
    >
      <summary aria-label="Navigation menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </summary>
      <nav
        aria-label="Mobile navigation"
        className="mobile-nav-panel"
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a") && disclosure.current) disclosure.current.open = false;
        }}
      >
        {children}
      </nav>
    </details>
  );
}
