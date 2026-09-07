import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { createClient } from "@/lib/supabase/server";
import { categoryOrder, categoryLabels, categoryDiagnosticTier } from "@/lib/category";

const TIER_BLURB = {
  full: "Full diagnostic report — benchmark score, draw under load, boot verified.",
  "wattage-boot": "Draw under load + boot verified.",
  "boot-only": "Boot verified.",
} as const;

export default async function SellPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/sell");

  return (
    <PageShell>

      <PageHeading eyebrow="For sellers" title="What are you selling?" description="Choose your hardware category. We’ll tailor the listing details and photo requirements to your part." />

        <div className="category-choices">
          {categoryOrder.map((category) => (
            <Link
              key={category}
              href={`/sell/${category.toLowerCase()}`}
              className="category-choice"
            >
              <div><h2>
                {categoryLabels[category]}
              </h2>
              <p className="category-choice-description">
                {TIER_BLURB[categoryDiagnosticTier[category]]}
              </p></div>
              <span className="category-choice-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
    </PageShell>
  );
}
