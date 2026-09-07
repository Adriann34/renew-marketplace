"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Mounted only while open. Keeps keyboard focus inside and restores the trigger. */
export function Dialog({ label, onClose, className = "", children }: {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panel.current?.querySelector<HTMLElement>("button, a[href], input, select, textarea, [tabindex='0']");
    (first ?? panel.current)?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(<div
    ref={panel}
    role="dialog"
    aria-modal="true"
    aria-label={label}
    tabIndex={-1}
    className={`ui-dialog ${className}`}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={(event) => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key !== "Tab") return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']") ?? []).filter((el) => el.getClientRects().length > 0);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
  >{children}</div>, document.body);
}
