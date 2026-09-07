"use client";
import { Button } from "@/components/ui/Button";

import { useActionState, useState } from "react";
import type { Category } from "@prisma/client";
import {
  createListingAction,
  autofillDiagnosticsAction,
  type CreateListingState,
} from "@/app/sell/actions";
import { Spinner } from "@/components/Spinner";
import { ListingBasics, ListingDiagnostics } from "@/components/listing/ListingFields";
import {
  PhotoWorkspace,
  getPhotoCategoriesForTier,
  emptyPhotosState,
  usePhotoUrls,
  type PhotosState,
} from "@/components/listing/PhotoWorkspace";
import { ListingPreviewCard, type PreviewFields } from "@/components/listing/ListingPreviewCard";
import { categoryDiagnosticTier } from "@/lib/category";

const initialState: CreateListingState = { error: null };

export function CreateListingForm({
  category,
  initialLocation = "",
  initialCurrency = "USD",
}: {
  category: Category;
  initialLocation?: string;
  initialCurrency?: string;
}) {
  const [state, formAction, isPending] = useActionState(createListingAction, initialState);
  const [photos, setPhotos] = useState<PhotosState>(emptyPhotosState);
  const [fields, setFields] = useState<PreviewFields>({
    title: "",
    price: "",
    currency: initialCurrency,
    spec: "",
    location: initialLocation,
    grade: null,
    benchmarkLabel: "",
    benchmarkScore: "",
    wattageDraw: "",
    bootVerified: false,
  });

  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  function patchFields(patch: Partial<PreviewFields>) {
    setFields((f) => ({ ...f, ...patch }));
  }

  const tier = categoryDiagnosticTier[category];
  const hasBenchmark = tier === "full";
  const photoCategories = getPhotoCategoriesForTier(tier);

  const flatPhotos = photoCategories.flatMap((c) => photos[c.key]);
  const flatPhotoUrls = usePhotoUrls(flatPhotos);
  const filledCategories = photoCategories.filter((c) => photos[c.key].length > 0).length;

  // AI autofill is gated on having a photo in every proof category, so the model
  // has evidence for each diagnostic field. The extraction itself runs server-side.
  const allCategoriesFilled = filledCategories === photoCategories.length;

  async function handleAutofill() {
    if (!allCategoriesFilled || autofilling) return;
    setAutofillError(null);
    setAutofilling(true);
    try {
      const fd = new FormData();
      for (const c of photoCategories) {
        for (const item of photos[c.key]) {
          if (item.type === "new") fd.append(c.field, item.file);
        }
      }
      const res = await autofillDiagnosticsAction(fd);
      if ("error" in res) {
        setAutofillError(res.error);
        return;
      }
      const f = res.fields;
      patchFields({
        grade: f.grade,
        benchmarkLabel: f.benchmarkLabel,
        benchmarkScore: f.benchmarkScore ? String(f.benchmarkScore) : "",
        wattageDraw: f.wattageDraw ? String(f.wattageDraw) : "",
        bootVerified: f.bootVerified,
      });
    } catch {
      setAutofillError("Autofill failed. Please try again.");
    } finally {
      setAutofilling(false);
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="category" value={category} />

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
            onPhotosChange={(key, files) => setPhotos((p) => ({ ...p, [key]: files }))}
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
          <ListingBasics category={category} fields={fields} onChange={patchFields} />
          <ListingDiagnostics category={category} fields={fields} onChange={patchFields}>
            {hasBenchmark && <div className="space-y-2">
              <Button variant="secondary" size="small" onClick={handleAutofill} disabled={!allCategoriesFilled || autofilling || isPending} title={allCategoriesFilled ? "Read your proof photos and fill this in" : "Add a photo to each proof category first"}>
                {autofilling ? <Spinner size={14} /> : <span aria-hidden>✦</span>}
                {autofilling ? "Reading photos…" : "AI autofill"}
              </Button>
              {!allCategoriesFilled && <p className="text-[12px] text-ink-dim">Add a photo to each proof category to enable AI autofill.</p>}
              {autofillError && <p role="alert" className="text-[12px] text-danger">{autofillError}</p>}
            </div>}
          </ListingDiagnostics>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className={`text-[13px] ${photos.condition.length ? "text-pass font-medium" : "text-ink-dim"}`}>
              {photos.condition.length
                ? "Looks good — condition photos attached."
                : "Add at least one condition photo to publish."}
            </p>
            <div className="flex gap-3 ml-auto">
              <Button variant="secondary"
                disabled
                title="Coming soon"
              >
                Save draft
              </Button>
              <Button
                type="submit"
                disabled={isPending || autofilling}
              >
                {isPending && <Spinner size={16} />}
                {isPending ? "Publishing…" : "Publish listing"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
