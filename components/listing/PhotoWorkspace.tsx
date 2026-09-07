"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PhotoKind } from "@prisma/client";
import type { DiagnosticTier } from "@/lib/category";
import {
  MAX_PHOTO_BYTES,
  MAX_PHOTOS_PER_LISTING,
  MAX_TOTAL_UPLOAD_BYTES,
  formatMb,
  isAllowedPhoto,
} from "@/lib/photoLimits";

const SUPPORTED_LABEL = "JPEG, PNG, WebP, or HEIC";

export type PhotoCategoryKey = "condition" | "burn_in" | "benchmark" | "boot";

export type PhotoItem = { type: "new"; file: File } | { type: "existing"; id: string; url: string };

export type PhotosState = Record<PhotoCategoryKey, PhotoItem[]>;

export const emptyPhotosState: PhotosState = {
  condition: [],
  burn_in: [],
  benchmark: [],
  boot: [],
};

const PHOTO_KIND_TO_CATEGORY: Record<PhotoKind, PhotoCategoryKey> = {
  CONDITION: "condition",
  BURN_IN: "burn_in",
  BENCHMARK: "benchmark",
  BOOT: "boot",
};

/** Seeds a PhotosState from an existing listing's photos, for the edit form. */
export function photosStateFromExisting(
  photos: { id: string; url: string; kind: PhotoKind }[]
): PhotosState {
  const state: PhotosState = {
    condition: [],
    burn_in: [],
    benchmark: [],
    boot: [],
  };
  for (const photo of photos) {
    state[PHOTO_KIND_TO_CATEGORY[photo.kind]].push({ type: "existing", id: photo.id, url: photo.url });
  }
  return state;
}

const ALL_PHOTO_CATEGORIES: {
  key: PhotoCategoryKey;
  field: string;
  label: string;
  required: boolean;
  hint: string;
  tiers: DiagnosticTier[];
}[] = [
  {
    key: "condition",
    field: "photos_condition",
    label: "Condition photos",
    required: true,
    hint: "Close-up photos showing physical condition and any wear.",
    tiers: ["full", "wattage-boot", "boot-only"],
  },
  {
    key: "burn_in",
    field: "photos_burn_in",
    label: "Burn-in proof",
    required: false,
    hint: "A photo or screenshot from a sustained load test.",
    tiers: ["full", "wattage-boot"],
  },
  {
    key: "benchmark",
    field: "photos_benchmark",
    label: "Benchmark shot",
    required: false,
    hint: "Screenshot of the benchmark score above.",
    tiers: ["full"],
  },
  {
    key: "boot",
    field: "photos_boot",
    label: "Boot / POST",
    required: false,
    hint: "Proof the part boots and is recognized correctly.",
    tiers: ["full", "wattage-boot", "boot-only"],
  },
];

export function getPhotoCategoriesForTier(tier: DiagnosticTier) {
  return ALL_PHOTO_CATEGORIES.filter((c) => c.tiers.includes(tier));
}

/** Resolves a mix of existing (already-hosted) and new (in-memory) photos to displayable URLs, creating/revoking object URLs only for the new ones. */
export function usePhotoUrls(items: PhotoItem[]): string[] {
  const urls = useMemo(
    () => items.map((item) => (item.type === "existing" ? item.url : URL.createObjectURL(item.file))),
    [items]
  );
  useEffect(() => {
    return () => {
      items.forEach((item, i) => {
        if (item.type === "new") URL.revokeObjectURL(urls[i]);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urls]);
  return urls;
}

/** Keeps a hidden, named file input in sync with the "new" photos so they ride along with the surrounding <form> submission. Existing photos need no file input — the server already has them. */
function HiddenFileInput({ field, items }: { field: string; items: PhotoItem[] }) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const dt = new DataTransfer();
    items.forEach((item) => {
      if (item.type === "new") dt.items.add(item.file);
    });
    ref.current.files = dt.files;
  }, [items]);

  return <input ref={ref} type="file" name={field} multiple hidden />;
}

export function PhotoWorkspace({
  tier,
  photos,
  onPhotosChange,
  onRemoveExisting,
}: {
  tier: DiagnosticTier;
  photos: PhotosState;
  onPhotosChange: (key: PhotoCategoryKey, items: PhotoItem[]) => void;
  /** Called when a previously-uploaded photo is removed, so the caller can track it for deletion on save. */
  onRemoveExisting?: (id: string) => void;
}) {
  const categories = getPhotoCategoriesForTier(tier);
  const [activeTab, setActiveTab] = useState<PhotoCategoryKey>("condition");
  const [activeIndex, setActiveIndex] = useState<Record<PhotoCategoryKey, number>>({
    condition: 0,
    burn_in: 0,
    benchmark: 0,
    boot: 0,
  });
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  const meta = categories.find((c) => c.key === activeTab) ?? categories[0];
  const activePhotos = photos[activeTab];
  const idx = Math.min(activeIndex[activeTab], Math.max(0, activePhotos.length - 1));
  const urls = usePhotoUrls(activePhotos);

  // Totals across every photo category, so the count and total-upload-size
  // limits are enforced listing-wide, not per-tab. Only "new" files count
  // toward upload bytes — "existing" photos (edit form) are already hosted and
  // aren't re-uploaded.
  const totals = useMemo(() => {
    let count = 0;
    let newBytes = 0;
    for (const items of Object.values(photos)) {
      for (const item of items) {
        count += 1;
        if (item.type === "new") newBytes += item.file.size;
      }
    }
    return { count, newBytes };
  }, [photos]);

  // Validates each incoming file against type, per-photo size, the listing-wide
  // photo count, and the total upload budget — rejecting anything invalid with
  // a clear message *before* it's added to the form. This is what makes an
  // over-limit request impossible to build, so the upload can never error out.
  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList);
    if (!incoming.length) return;

    const accepted: File[] = [];
    const errors: string[] = [];
    let runningCount = totals.count;
    let runningBytes = totals.newBytes;

    for (const file of incoming) {
      if (!isAllowedPhoto(file)) {
        errors.push(`"${file.name}" isn't a supported image — use ${SUPPORTED_LABEL}.`);
        continue;
      }
      if (file.size > MAX_PHOTO_BYTES) {
        errors.push(`"${file.name}" is ${formatMb(file.size)} — the limit is ${formatMb(MAX_PHOTO_BYTES)} per photo.`);
        continue;
      }
      if (runningCount + 1 > MAX_PHOTOS_PER_LISTING) {
        errors.push(`You can attach at most ${MAX_PHOTOS_PER_LISTING} photos per listing.`);
        break;
      }
      if (runningBytes + file.size > MAX_TOTAL_UPLOAD_BYTES) {
        errors.push(
          `Adding "${file.name}" would exceed the ${formatMb(MAX_TOTAL_UPLOAD_BYTES)} total upload limit — remove a photo or use a smaller file.`
        );
        continue;
      }
      accepted.push(file);
      runningCount += 1;
      runningBytes += file.size;
    }

    if (accepted.length) {
      const next: PhotoItem[] = [
        ...photos[activeTab],
        ...accepted.map((file) => ({ type: "new" as const, file })),
      ];
      onPhotosChange(activeTab, next);
      setActiveIndex((s) => ({ ...s, [activeTab]: next.length - 1 }));
    }
    setError(errors[0] ?? null);
  }

  function removeAt(i: number) {
    const item = photos[activeTab][i];
    if (item.type === "existing") onRemoveExisting?.(item.id);
    const next = photos[activeTab].filter((_, j) => j !== i);
    onPhotosChange(activeTab, next);
    setActiveIndex((s) => ({ ...s, [activeTab]: Math.max(0, Math.min(s[activeTab], next.length - 1)) }));
    setError(null); // removing frees up budget — clear any stale limit warning
  }

  function goTo(i: number) {
    setActiveIndex((s) => ({ ...s, [activeTab]: i }));
  }

  return (
    <div className="photo-workspace">
      <div className="photo-tabs">
        {categories.map((c) => {
          const count = photos[c.key].length;
          const active = c.key === activeTab;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => {
                setActiveTab(c.key);
                setError(null);
              }}
              className="photo-tab"
              aria-pressed={active}
            >
              {c.label}
              {c.required && <span className="opacity-70">*</span>}
              {count > 0 && (
                <span
                  className={`text-[10px] px-1.5 ${active ? "bg-bg-inset/30" : "bg-line/60"}`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={`photo-dropzone ${dragging ? "photo-dropzone-dragging" : ""}`}
      >
        {activePhotos.length === 0 ? (
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6"
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-dim">
              <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              <polyline points="7 9 12 4 17 9" />
              <line x1="12" y1="4" x2="12" y2="16" />
            </svg>
            <span className="text-[13px] font-medium text-ink-dim">Drop photos here, or click to browse</span>
            <span className="text-[11px] text-ink-dim/70 max-w-55">{meta.hint}</span>
          </button>
        ) : (
          <>
            <img src={urls[idx]} alt={`${meta.label} ${idx + 1}`} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(idx)}
              aria-label="Remove photo"
              className="absolute top-2 right-2 w-10 h-10 flex items-center justify-center bg-black/60 text-white hover:bg-danger transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {activePhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => goTo((idx - 1 + activePhotos.length) % activePhotos.length)}
                  aria-label="Previous photo"
                  className="absolute top-1/2 -translate-y-1/2 left-2 w-10 h-10 flex items-center justify-center bg-black/50 text-white hover:bg-black/80 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => goTo((idx + 1) % activePhotos.length)}
                  aria-label="Next photo"
                  className="absolute top-1/2 -translate-y-1/2 right-2 w-10 h-10 flex items-center justify-center bg-black/50 text-white hover:bg-black/80 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <div className="absolute bottom-2 left-0 right-0 flex gap-1.5 justify-center">
                  {activePhotos.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Go to photo ${i + 1}`}
                      className={`h-1 transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {activePhotos.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {urls.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`View ${meta.label} photo ${i + 1}`}
              aria-pressed={i === idx}
              className={`relative w-14 h-14 rounded-xl shrink-0 border overflow-hidden ${
                i === idx ? "border-accent" : "border-line"
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            aria-label="Add more photos"
            className="w-14 h-14 rounded-xl shrink-0 border border-dashed border-line flex items-center justify-center text-ink-dim hover:border-accent hover:text-accent transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      )}

      {error && (
        <p className="text-[12px] text-danger mt-3 flex items-start gap-1.5" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      )}

      <p className="text-[11px] text-ink-dim mt-3">
        {meta.hint} · {SUPPORTED_LABEL} · up to {formatMb(MAX_PHOTO_BYTES)} each
      </p>

      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files ?? []);
          e.target.value = "";
        }}
      />

      {categories.map((c) => (
        <HiddenFileInput key={c.key} field={c.field} items={photos[c.key]} />
      ))}
    </div>
  );
}
