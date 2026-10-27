import { cache } from "react";
import { cookies, headers } from "next/headers";
import { CURRENCY_COOKIE, resolveDisplayCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// Shared by the layout and browse page, with one auth/preference lookup per render.
export const getViewerCurrency = cache(async () => {
  const country = (await headers()).get("x-vercel-ip-country");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const preferred = user
    ? await prisma.user.findUnique({ where: { id: user.id }, select: { preferredCurrency: true } })
      .then((u) => u?.preferredCurrency ?? null).catch(() => null)
    : null;
  const cookie = user ? null : (await cookies()).get(CURRENCY_COOKIE)?.value;
  return {
    displayCurrency: resolveDisplayCurrency({ preferred, country, cookie }),
    signedIn: !!user,
  };
});
