import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { EditListingForm } from "@/components/listing/EditListingForm";
import { getListingById } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const returnTo = safeInternalPath(from, "/browse");
  const listingPath = `/listing/${id}?from=${encodeURIComponent(returnTo)}`;
  const editPath = `/listing/${id}/edit?from=${encodeURIComponent(returnTo)}`;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(editPath)}`);
  if (user.id !== listing.sellerId) redirect(listingPath);

  return (
    <PageShell>

        <Link
          href={listingPath}
          className="market-text-link mb-6"
        >
          ← Back to listing
        </Link>
      <PageHeading eyebrow="For sellers" title="Edit listing" description="Update your diagnostic report or photos. Changes go live when you save." />

        <EditListingForm listing={listing} returnTo={returnTo} />
    </PageShell>
  );
}
