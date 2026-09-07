import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { AccountView } from "@/components/account/AccountView";
import { getListingsBySeller } from "@/lib/listings";
import { getSavedListings } from "@/lib/saved";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const ACCOUNT_TABS = ["listings", "saved", "settings"] as const;
type AccountTab = (typeof ACCOUNT_TABS)[number];

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: AccountTab = ACCOUNT_TABS.includes(tab as AccountTab)
    ? (tab as AccountTab)
    : "listings";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/account");

  const [dbUser, listings, saved] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    getListingsBySeller(user.id),
    getSavedListings(user.id),
  ]);

  const profile = {
    name: dbUser?.name ?? (user.user_metadata?.name as string | undefined) ?? null,
    email: user.email!,
    phone: dbUser?.phone ?? null,
    location: dbUser?.location ?? null,
    avatarUrl: dbUser?.avatarUrl ?? null,
    preferredCurrency: dbUser?.preferredCurrency ?? null,
    createdAt: dbUser?.createdAt ?? new Date(user.created_at),
  };

  return (
    <PageShell>

      <PageHeading eyebrow="Account" title="My account" />

      <AccountView profile={profile} listings={listings} saved={saved} initialTab={initialTab} />

    </PageShell>
  );
}
