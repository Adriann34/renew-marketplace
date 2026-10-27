import { PageContent } from "@/components/ui/Page";
import { BrowseView } from "@/components/browse/BrowseView";
import { CurrencyProvider } from "@/components/CurrencyProvider";
import { getBrowseListings } from "@/lib/browseListings";
import { browseUrl, parseBrowseParams, type BrowseParams } from "@/lib/browseParams";
import { getRates } from "@/lib/exchangeRates";
import { getViewerCurrency } from "@/lib/viewerCurrency";

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<BrowseParams>;
}) {
  const [params, viewer, rates] = await Promise.all([searchParams, getViewerCurrency(), getRates()]);
  const state = parseBrowseParams(params, viewer.displayCurrency);
  const results = await getBrowseListings(state, rates);
  state.page = results.page;

  return (
    <PageContent className="browse-page">
      <CurrencyProvider key={state.currency} initialDisplayCurrency={state.currency} rates={rates} canPersist={false}>
        <BrowseView state={state} results={results} returnTo={browseUrl(state)} />
      </CurrencyProvider>
    </PageContent>
  );
}
