import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { getRates } from "@/lib/exchangeRates";
import { getViewerCurrency } from "@/lib/viewerCurrency";

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
  const [{ displayCurrency, signedIn }, rates] = await Promise.all([getViewerCurrency(), getRates()]);

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
