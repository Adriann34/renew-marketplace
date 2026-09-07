import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { CreateListingForm } from "@/components/listing/CreateListingForm";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { categoryFromSlug, categoryLabels } from "@/lib/category";

export default async function SellCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=/sell/${slug}`);

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  return (
    <PageShell>

        <Link href="/sell" className="market-text-link mb-6">
          ← Change category
        </Link>
      <PageHeading eyebrow="For sellers" title={`List your ${categoryLabels[category]}`} description="Share the details, add your photos, and help your hardware find its next home." />

        <CreateListingForm
          category={category}
          initialLocation={dbUser?.location ?? ""}
          initialCurrency={dbUser?.preferredCurrency ?? "USD"}
        />
    </PageShell>
  );
}
