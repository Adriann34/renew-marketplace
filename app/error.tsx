"use client";

import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content" className="market-container app-page app-page-reading">
    <Link href="/" className="market-wordmark mb-12" aria-label="Renew home">renew</Link>
    <PageHeading title="Something didn’t load." description="Please try again in a moment." />
    <div className="flex flex-wrap gap-3"><Button onClick={reset}>Try again</Button><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></div>
  </main>;
}
