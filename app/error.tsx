"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { PageHeading } from "@/components/ui/PageHeading";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  function retry() {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }
  return <main id="main-content" className="market-container app-page app-page-reading">
    <Link href="/" className="market-wordmark mb-12" aria-label="Renew home">renew</Link>
    <PageHeading title="Something didn’t load." description="Please try again in a moment." />
    <div className="flex flex-wrap gap-3"><Button onClick={retry} disabled={pending}>{pending ? "Trying again…" : "Try again"}</Button><ButtonLink href="/" variant="secondary">Back to home</ButtonLink></div>
  </main>;
}
