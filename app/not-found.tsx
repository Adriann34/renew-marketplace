import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return <PageShell width="reading">
    <PageHeading eyebrow="Page not found" title="This page has moved on." description="The page or listing you’re looking for isn’t available. There’s more good hardware waiting to be discovered." />
    <ButtonLink href="/browse">Explore hardware</ButtonLink>
  </PageShell>;
}
