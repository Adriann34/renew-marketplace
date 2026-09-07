import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// The ONLY User fields safe to serialize to the browser. `email` and `phone` are
// PII and must never ride along in a listing/conversation payload — buyer↔seller
// contact happens through chat, not by exposing contact details. Every place that
// embeds a User (seller/buyer/sender) uses this projection.
export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} satisfies Prisma.UserSelect;

export type ListingWithRelations = Prisma.ListingGetPayload<{
  include: { photos: true; seller: { select: typeof PUBLIC_USER_SELECT } };
}>;

export type ListingWithSaveCount = Prisma.ListingGetPayload<{
  include: {
    photos: true;
    seller: { select: typeof PUBLIC_USER_SELECT };
    _count: { select: { savedBy: true } };
  };
}>;

export function getListings(limit?: number) {
  return prisma.listing.findMany({
    where: { status: "ACTIVE" },
    ...(limit === undefined ? {} : { take: limit }),
    include: { photos: true, seller: { select: PUBLIC_USER_SELECT } },
    orderBy: { createdAt: "desc" },
  });
}

export function getListingById(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: { photos: true, seller: { select: PUBLIC_USER_SELECT } },
  });
}

export function getListingsBySeller(sellerId: string) {
  return prisma.listing.findMany({
    where: { sellerId },
    include: {
      photos: true,
      seller: { select: PUBLIC_USER_SELECT },
      _count: { select: { savedBy: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
