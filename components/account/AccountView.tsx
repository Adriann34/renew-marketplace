"use client";
import { Button, ButtonLink } from "@/components/ui/Button";

import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { ManageListingCard } from "@/components/account/ManageListingCard";
import { SavedListingCard } from "@/components/account/SavedListingCard";
import { SettingsPanel } from "@/components/account/SettingsPanel";
import type { ListingWithRelations, ListingWithSaveCount } from "@/lib/listings";

type Tab = "listings" | "saved" | "settings";
type StatusFilter = "all" | "ACTIVE" | "SOLD";

export function AccountView({
  profile,
  listings,
  saved,
  initialTab = "listings",
}: {
  profile: {
    name: string | null;
    email: string;
    phone: string | null;
    location: string | null;
    avatarUrl: string | null;
    preferredCurrency: string | null;
    createdAt: Date;
  };
  listings: ListingWithSaveCount[];
  saved: ListingWithRelations[];
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const displayName = profile.name || profile.email;
  const initials = displayName.slice(0, 2).toUpperCase();
  const memberSince = profile.createdAt.toLocaleDateString(undefined, { month: "short", year: "numeric" });

  const filteredListings =
    statusFilter === "all" ? listings : listings.filter((l) => l.status === statusFilter);

  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <div className="account-profile">
          <div className="avatar w-14 h-14 mb-4">
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={displayName} /> : initials}
          </div>
          <p className="text-[18px] font-medium mb-1">{displayName}</p>
          <p className="text-ink-dim text-[13px] break-all">{profile.email}</p>
          <div className="text-[12px] text-ink-dim mt-4 space-y-1">
            {profile.location && <p>{profile.location}</p>}
            <p>Member since {memberSince}</p>
          </div>
        </div>
        <nav className="account-nav" aria-label="Account sections">
          {([
            { id: "listings", label: "Your listings", count: listings.length },
            { id: "saved", label: "Saved items", count: saved.length },
            { id: "settings", label: "Account settings" },
          ] as const).map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className="account-nav-item" aria-current={tab === item.id ? "page" : undefined}>
              {item.label}{"count" in item && <span className="ml-auto text-[12px] tabular-nums text-ink-dim">{item.count}</span>}
            </button>
          ))}
          <SignOutButton className="account-nav-item text-danger" />
        </nav>
      </aside>
      <div className="min-w-0">
        {tab === "listings" && <>
          <div className="account-toolbar">
            <h2>Your listings</h2>
            <ButtonLink href="/sell" size="small">List an item <span aria-hidden="true">＋</span></ButtonLink>
          </div>
          <div className="segmented-control mb-6" aria-label="Listing status">
            {(["all", "ACTIVE", "SOLD"] as const).map((filter) => (
              <button key={filter} type="button" className="segment" aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>
                {filter === "all" ? "All" : filter === "ACTIVE" ? "Active" : "Sold"}
              </button>
            ))}
          </div>
          {filteredListings.length === 0 ? (
            <EmptyState title={listings.length === 0 ? "Room for something good." : "Nothing here yet."} action={listings.length === 0 ? <ButtonLink href="/sell" variant="secondary">List your hardware</ButtonLink> : <Button variant="quiet" onClick={() => setStatusFilter("all")}>Show all listings</Button>}>
              {listings.length === 0 ? "Give your hardware a new beginning. Your listings will appear here." : "Try another status to find your listings."}
            </EmptyState>
          ) : <div className="manage-list">{filteredListings.map((listing) => <ManageListingCard key={listing.id} listing={listing} />)}</div>}
        </>}
        {tab === "saved" && <>
          <h2 className="account-title mb-7">Saved items</h2>
          {saved.length === 0 ? <EmptyState title="Keep something in mind." action={<ButtonLink href="/browse" variant="secondary">Explore hardware</ButtonLink>}>Save a listing that catches your eye and find it here when you’re ready.</EmptyState> : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">{saved.map((listing) => <SavedListingCard key={listing.id} listing={listing} />)}</div>
          )}
        </>}
        {tab === "settings" && <>
          <h2 className="account-title mb-8">Account settings</h2>
          <SettingsPanel email={profile.email} name={profile.name ?? ""} phone={profile.phone ?? ""} location={profile.location ?? ""} avatarUrl={profile.avatarUrl} />
        </>}
      </div>
    </div>
  );
}
