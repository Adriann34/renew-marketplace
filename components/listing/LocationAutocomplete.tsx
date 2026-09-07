"use client";
import { Input } from "@/components/ui/Field";

import { useEffect, useRef, useState } from "react";

export function LocationAutocomplete({
  name,
  initialValue,
  onValueChange,
}: {
  name: string;
  initialValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cities?q=${encodeURIComponent(value)}`);
        const { results } = await res.json();
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [value]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={name}
        name={name}
        type="text"
        required
        autoComplete="off"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          onValueChange?.(e.target.value);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Manila, Philippines"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-10 top-full left-0 right-0 mt-2 p-1 border border-line bg-bg-elevated rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {Array.from(new Set(suggestions)).map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  setValue(suggestion);
                  setSuggestions([]);
                  setOpen(false);
                  onValueChange?.(suggestion);
                }}
                className="w-full text-left px-3 py-3 rounded-lg text-[14px] text-ink hover:bg-bg-inset transition-colors"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
