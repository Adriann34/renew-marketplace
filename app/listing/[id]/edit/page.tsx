import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { EditListingForm } from "@/components/listing/EditListingForm";
import { getListingById } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=/listing/${id}/edit`);
  if (user.id !== listing.sellerId) redirect(`/listing/${id}`);

  return (
    <PageShell>

        <Link
          href={`/listing/${id}`}
          className="market-text-link mb-6"
        >
          ← Back to listing
        </Link>
      <PageHeading eyebrow="For sellers" title="Edit listing" description="Update your diagnostic report or photos. Changes go live when you save." />

        <EditListingForm listing={listing} />
    </PageShell>
  );
}
