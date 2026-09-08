"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "renew-theme";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const syncTheme = () => setIsDark(document.documentElement.dataset.theme === "dark");
    syncTheme();
    window.addEventListener("renew-theme-change", syncTheme);
    return () => window.removeEventListener("renew-theme-change", syncTheme);
  }, []);

  function toggle() {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    window.dispatchEvent(new Event("renew-theme-change"));
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // The theme still works when browser storage is unavailable.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="market-theme-toggle"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {isDark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />}
      </svg>
    </button>
  );
}
