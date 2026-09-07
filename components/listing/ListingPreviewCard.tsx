"use client";

import { useState } from "react";
import type { Grade } from "@prisma/client";
import { ConditionBadge } from "@/components/ConditionBadge";
import { ListingImage } from "@/components/listing/ListingImage";
import { formatMoney } from "@/lib/format";

export type PreviewFields = {
  title: string;
  price: string;
  currency: string;
  spec: string;
  location: string;
  grade: Grade | null;
  benchmarkLabel: string;
  benchmarkScore: string;
  wattageDraw: string;
  bootVerified: boolean;
};

export function ListingPreviewCard({
  fields,
  photos: urls,
  filledCategories,
  totalCategories,
}: {
  fields: PreviewFields;
  /** Already-resolved display URLs (object URLs for new files, hosted URLs for existing photos). */
  photos: string[];
  filledCategories: number;
  totalCategories: number;
}) {
  const [index, setIndex] = useState(0);

  const clampedIndex = Math.min(index, Math.max(0, urls.length - 1));
  const price = Number(fields.price.replace(/[^0-9.]/g, ""));
  const draw = Number(fields.wattageDraw);

  const diagPills = [
    fields.benchmarkLabel || fields.benchmarkScore
      ? `${fields.benchmarkLabel || "Benchmark"} · ${fields.benchmarkScore || "—"}`
      : null,
    draw > 0 ? `${draw}W under load` : null,
    fields.bootVerified ? "Boots & POSTs ✓" : null,
  ].filter((p): p is string => Boolean(p));

  return (
    <div className="market-listing-card">
      <ListingImage src={urls[clampedIndex]} title={fields.title || "Listing preview"}>
        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + urls.length) % urls.length)}
              aria-label="Previous photo"
              className="absolute top-1/2 -translate-y-1/2 left-2 w-10 h-10 flex items-center justify-center bg-black/50 text-white transition-opacity hover:bg-black/80"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % urls.length)}
              aria-label="Next photo"
              className="absolute top-1/2 -translate-y-1/2 right-2 w-10 h-10 flex items-center justify-center bg-black/50 text-white transition-opacity hover:bg-black/80"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}
      </ListingImage>

      <div className="listing-content space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-display font-medium text-[15px] leading-snug">
            {fields.title || "Your listing title"}
          </h3>
          <p className="font-body tabular-nums text-ink text-[20px] font-medium">
            {fields.price && !Number.isNaN(price) ? formatMoney(price, fields.currency) : "—"}
          </p>
        </div>

        <p className="text-ink-dim text-[13px]">{fields.spec || "Spec details"}</p>

        <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-dim">
          {fields.grade ? <ConditionBadge grade={fields.grade} /> : <span className="listing-condition">Condition</span>}
          <span className="opacity-50">·</span>
          <span>{fields.location || "Location"}</span>
        </div>

        {diagPills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {diagPills.map((p, i) => (
              <span key={i} className="status-badge">
                {p}
              </span>
            ))}
          </div>
        )}

        <div className="border-t border-line pt-3">
          <div className="flex justify-between text-[10px] text-ink-dim mb-1.5 font-medium">
            <span>Verification</span>
            <span className="font-body">
              {filledCategories}/{totalCategories}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-bg-inset overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(filledCategories / totalCategories) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
