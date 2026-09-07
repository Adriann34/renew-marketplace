"use client";

import { useState, useEffect, useCallback } from "react";
import { Dialog } from "@/components/ui/Dialog";
import Image from "next/image";
import { GpuMark } from "@/components/icons/GpuMark";
import type { PhotoKind } from "@prisma/client";

export type GalleryGroup = {
  kind: PhotoKind;
  label: string;
  photos: { id: string; url: string }[];
};

export function ListingGallery({
  groups,
  title,
}: {
  groups: GalleryGroup[];
  title: string;
}) {
  const [tabIdx, setTabIdx] = useState(0);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  const group = groups[tabIdx];
  const count = group?.photos.length ?? 0;
  const multi = count > 1;

  const step = useCallback(
    (delta: number) => {
      setPhotoIdx((i) => (i + delta + count) % count);
    },
    [count],
  );

  // Arrow-key navigation supplements the shared dialog’s focus and scroll handling.
  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, step]);

  if (groups.length === 0) {
    return (
      <div className="aspect-4/3 rounded-2xl flex items-center justify-center bg-bg-inset p-16">
        <GpuMark className="w-full h-full text-ink-dim" />
      </div>
    );
  }

  const photo = group.photos[photoIdx];

  function selectTab(i: number) {
    setTabIdx(i);
    setPhotoIdx(0);
  }

  return (
    <>
      <div className="space-y-4">
        <div className="photo-tabs">
          {groups.map((g, i) => (
            <button
              key={g.kind}
              type="button"
              onClick={() => selectTab(i)}
              className="photo-tab"
              aria-pressed={i === tabIdx}
            >
              {g.label}
            </button>
          ))}
        </div>

        <div className="aspect-4/3 relative rounded-2xl bg-bg-inset overflow-hidden">
          <Image
            key={photo.id}
            src={photo.url}
            alt={`${group.label} photo for ${title}`}
            fill
            className="object-cover"
          />

          {/* Full-surface click target to expand into the lightbox. */}
          <button
            type="button"
            onClick={() => setLightbox(true)}
            aria-label="Expand photo"
            className="absolute inset-0 z-0 cursor-zoom-in"
          />

          {multi && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-11 h-11 flex items-center justify-center rounded-xl bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                ›
              </button>
              <div className="absolute bottom-2 left-0 right-0 z-10 flex justify-center gap-1.5">
                {group.photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPhotoIdx(i)}
                    aria-label={`Go to photo ${i + 1}`}
                    className={`h-1.5 rounded-xl transition-all ${
                      i === photoIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {multi && (
          <div className="flex gap-2 flex-wrap">
            {group.photos.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhotoIdx(i)}
                aria-label={`View ${group.label} photo ${i + 1}`}
                aria-pressed={i === photoIdx}
                className={`relative w-13 h-13 shrink-0 overflow-hidden rounded-xl border-2 transition-colors ${
                  i === photoIdx ? "border-accent" : "border-transparent"
                }`}
              >
                <Image src={p.url} alt="" fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <Dialog label={`${group.label} photos for ${title}`} onClose={() => setLightbox(false)} className="gallery-dialog">
          <button
            type="button"
            onClick={() => setLightbox(false)}
            aria-label="Close"
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
          >
            ✕
          </button>

          {multi && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                aria-label="Previous photo"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                aria-label="Next photo"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              >
                ›
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={`${group.label} photo for ${title}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[min(90vw,860px)] max-h-[82vh] w-auto h-auto object-contain rounded-xl"
          />

          {multi && (
            <div className="absolute bottom-5 left-0 right-0 flex justify-center">
              <span className="font-body text-[12px] text-white/90 bg-black/50 px-3 py-1 rounded-xl">
                {photoIdx + 1} / {count}
              </span>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
