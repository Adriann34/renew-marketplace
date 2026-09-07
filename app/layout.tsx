import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { getRates } from "@/lib/exchangeRates";
import { CURRENCY_COOKIE, resolveDisplayCurrency } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Renew | Used Hardware with Proof",
  description:
    "Buy and sell with the confidence you need.",
  icons: {
    // BMP-encoded .ico (16/32/48) — Safari can't decode SVG favicons or
    // PNG-compressed .ico frames, so this is the one file every browser reads.
    icon: [{ url: "/favicon.ico", sizes: "48x48" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve which currency to show prices in, and load approximate FX rates.
  //
  // Signed-in users: their DB preference is authoritative and follows them across
  // devices (the cookie is ignored, so a stale cookie on another device can't
  // override a preference set elsewhere). Anonymous visitors: the per-device cookie,
  // then geolocation. Everything falls back to geo → USD.
  //
  // Vercel injects the visitor's geolocated country at the edge; absent locally (dev)
  // and for unknown IPs, so those resolve to USD unless a preference/cookie is set.
  const country = (await headers()).get("x-vercel-ip-country");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signedIn = !!user;

  let displayCurrency: string;
  if (user) {
    const preferred = await prisma.user
      .findUnique({ where: { id: user.id }, select: { preferredCurrency: true } })
      .then((u) => u?.preferredCurrency ?? null)
      .catch(() => null);
    displayCurrency = resolveDisplayCurrency({ preferred, country });
  } else {
    const cookieCurrency = (await cookies()).get(CURRENCY_COOKIE)?.value ?? null;
    displayCurrency = resolveDisplayCurrency({ cookie: cookieCurrency, country });
  }

  const rates = await getRates();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint so a saved dark-mode choice doesn't flash
            light first. Light stays the default when nothing is saved. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try {
              var t = localStorage.getItem('renew-theme');
              if (t === 'dark') document.documentElement.dataset.theme = 'dark';
            } catch (e) {}`,
          }}
        />
      </head>
      <body
        className={`${inter.variable} antialiased`}
      >
        <CurrencyProvider
          initialDisplayCurrency={displayCurrency}
          rates={rates}
          canPersist={signedIn}
        >
          {children}
        </CurrencyProvider>
      </body>
    </html>
  );
}
