"use client";

import { useState } from "react";
import type { AiVerificationResult, AiClaimStatus, AiVerificationStatus } from "@/lib/aiVerify";

const OVERALL: Record<
  AiVerificationStatus,
  { label: string; cls: string; dot: string }
> = {
  verified: {
    label: "Verified against photos",
    cls: "border-pass text-pass bg-pass/10",
    dot: "bg-pass",
  },
  partial: {
    label: "Partially verified",
    cls: "border-warning/25 text-warning bg-warning/10",
    dot: "bg-warning",
  },
  unverified: {
    label: "Not enough photo evidence",
    cls: "border-line text-ink-dim bg-bg-inset",
    dot: "bg-ink-dim",
  },
  flagged: {
    label: "Photos contradict the report",
    cls: "border-danger text-danger bg-danger/10",
    dot: "bg-danger",
  },
};

const CLAIM: Record<AiClaimStatus, { mark: string; cls: string; word: string }> = {
  match: { mark: "✓", cls: "text-pass", word: "Matches" },
  mismatch: { mark: "✗", cls: "text-danger", word: "Mismatch" },
  not_visible: { mark: "–", cls: "text-ink-dim", word: "Not visible" },
};

/**
 * The AI photo-verification verdict on the listing page. Shows the overall state
 * (verified / partial / unverified / flagged), a plain summary, and how many of the
 * checks were confirmed. The per-claim breakdown is behind a toggle so the panel
 * stays compact. The model's per-read confidence still drives which reads count
 * toward the verdict (see CONFIDENCE_GATE in lib/aiVerify), but the raw number is
 * intentionally not surfaced — it's an internal signal, not a user-facing metric.
 */
export function AiVerdictPanel({ result }: { result: AiVerificationResult }) {
  const [open, setOpen] = useState(false);
  const overall = OVERALL[result.status];
  const totalChecks = result.claims.length;

  return (
    <section className="verdict-section">
      <header className="verdict-heading">
        <span className="text-[16px] font-medium">Photo check</span>
        <span
          className={`inline-flex items-center gap-1.5 border text-[11px] font-medium px-2.5 py-1 rounded-xl  ${overall.cls}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${overall.dot}`} />
          {overall.label}
        </span>
      </header>

      <div className="py-3">
        <p className="text-[13.5px] leading-relaxed text-ink">{result.summary}</p>
        {result.status === "flagged" ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-danger">
            <span aria-hidden>⚠</span>
            Mismatch detected
          </p>
        ) : (
          <p className="mt-1.5 font-body text-[11px] text-ink-dim">
            {result.checksConfirmed} of {totalChecks} checks confirmed from the photos
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 py-3 border-t border-line text-[12.5px] text-ink-dim hover:text-ink transition-colors"
      >
        <span>
          {open ? "Hide" : "Show"} breakdown
          <span className="font-body text-[11px] text-ink-dim/70"> · {result.claims.length} checks</span>
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {result.claims.map((claim, i) => {
            const c = CLAIM[claim.status];
            return (
              <li key={i} className="py-4 flex gap-3">
                <span className={`font-body text-[15px] leading-5 shrink-0 ${c.cls}`} aria-hidden>
                  {c.mark}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[13px] font-medium capitalize">{claim.field}</p>
                    <span className={`text-[11px] font-body shrink-0 ${c.cls}`}>{c.word}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 font-body text-[11.5px] text-ink-dim">
                    <span className="break-words">
                      <span className="text-ink-dim/70">claimed:</span> {claim.claimed || "—"}
                    </span>
                    <span className="break-words">
                      <span className="text-ink-dim/70">observed:</span> {claim.observed || "—"}
                    </span>
                  </div>
                  {claim.note && <p className="mt-1 text-[12px] text-ink-dim leading-snug">{claim.note}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="py-3 border-t border-line text-[11px] text-ink-dim leading-snug">
        An evidence-based aid, not a guarantee — always review the proof photos yourself.
      </p>
    </section>
  );
}
