import { redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { createClient } from "@/lib/supabase/server";
import { categoryOrder, categoryLabels } from "@/lib/category";

export default async function SellPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/sell");

  return (
    <PageShell className="sell-category-page">

      <PageHeading title="What are you selling?" description="Select a hardware category to continue" />

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
              <span className="category-choice-arrow" aria-hidden="true">↗</span>
              </div>
            </Link>
          ))}
        </div>
    </PageShell>
  );
}
