"use client";
import { Button } from "@/components/ui/Button";

import { useActionState, useState } from "react";
import { updateListingAction, type UpdateListingState } from "@/app/listing/actions";
import { ListingBasics, ListingDiagnostics } from "@/components/listing/ListingFields";
import {
  PhotoWorkspace,
  getPhotoCategoriesForTier,
  photosStateFromExisting,
  usePhotoUrls,
  type PhotosState,
} from "@/components/listing/PhotoWorkspace";
import { ListingPreviewCard, type PreviewFields } from "@/components/listing/ListingPreviewCard";
import { categoryDiagnosticTier } from "@/lib/category";
import type { ListingWithRelations } from "@/lib/listings";

const initialState: UpdateListingState = { error: null };

export function EditListingForm({ listing, returnTo }: { listing: ListingWithRelations; returnTo: string }) {
  const [state, formAction, isPending] = useActionState(updateListingAction, initialState);
  const [photos, setPhotos] = useState<PhotosState>(() => photosStateFromExisting(listing.photos));
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [fields, setFields] = useState<PreviewFields>({
    title: listing.title,
    price: String(listing.price),
    currency: listing.currency,
    spec: listing.spec,
    location: listing.location,
    grade: listing.grade,
    benchmarkLabel: listing.benchmarkLabel,
    benchmarkScore: listing.benchmarkScore ? String(listing.benchmarkScore) : "",
    wattageDraw: listing.wattageDraw ? String(listing.wattageDraw) : "",
    bootVerified: listing.bootVerified,
  });

  function patchFields(patch: Partial<PreviewFields>) {
    setFields((f) => ({ ...f, ...patch }));
  }

  const category = listing.category;
  const tier = categoryDiagnosticTier[category];
  const photoCategories = getPhotoCategoriesForTier(tier);

  const flatPhotos = photoCategories.flatMap((c) => photos[c.key]);
  const flatPhotoUrls = usePhotoUrls(flatPhotos);
  const filledCategories = photoCategories.filter((c) => photos[c.key].length > 0).length;

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={listing.id} />
      <input type="hidden" name="category" value={category} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {removedPhotoIds.map((id) => (
        <input key={id} type="hidden" name="removedPhotoIds" value={id} />
      ))}

      {state.error && (
        <p role="alert" className="form-notice text-danger mb-6">
          {state.error}
        </p>
      )}

      <div className="seller-workspace">
        <aside className="seller-media">
          <PhotoWorkspace
            tier={tier}
            photos={photos}
            onPhotosChange={(key, items) => setPhotos((p) => ({ ...p, [key]: items }))}
            onRemoveExisting={(id) => setRemovedPhotoIds((ids) => [...ids, id])}
          />

          <div className="flex items-center gap-3">
            <p className="section-eyebrow mb-0">Live preview</p>
            <div className="flex-1 h-px bg-line" />
          </div>

          <ListingPreviewCard
            fields={fields}
            photos={flatPhotoUrls}
            filledCategories={filledCategories}
            totalCategories={photoCategories.length}
          />
        </aside>

        <div className="min-w-0">
          <ListingBasics category={category} fields={fields} onChange={patchFields} description={listing.description ?? ""} editing />
          <ListingDiagnostics category={category} fields={fields} onChange={patchFields} />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className={`text-[13px] ${photos.condition.length ? "text-pass font-medium" : "text-ink-dim"}`}>
              {photos.condition.length
                ? "Looks good — condition photos attached."
                : "Add at least one condition photo to save."}
            </p>
            <div className="flex gap-3 ml-auto">
              <Button
                type="submit"
                disabled={isPending}
              >
                {isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
