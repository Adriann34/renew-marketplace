import { ButtonLink } from "@/components/ui/Button";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { CategoryStrip } from "@/components/CategoryStrip";
import { TrustBar } from "@/components/TrustBar";
import { SellCta } from "@/components/SellCta";
import { Footer } from "@/components/Footer";
import { ListingCard } from "@/components/ListingCard";
import { getListings } from "@/lib/listings";

export default async function Home() {
  const listings = await getListings(6);

  return (
    <>
      <Navbar overlay />
      <main id="main-content" className="home-page">
        <Hero />
        <section id="listings" className="market-container home-listings" aria-labelledby="listings-heading">
          <CategoryStrip />
          <div className="section-heading">
            <h2 id="listings-heading">Latest listings</h2>
            <Link href="/browse" className="market-text-link">View all listings <span aria-hidden>→</span></Link>
          </div>
          {listings.length > 0 ? (
            <div className="home-listing-grid">
              {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
            </div>
          ) : (
            <div className="listings-empty">
              <h3>Room for something good.</h3>
              <p>There are no active listings yet. Give your hardware a new beginning.</p>
              <ButtonLink href="/sell" >List your hardware <span aria-hidden>→</span></ButtonLink>
            </div>
          )}
        </section>
        <TrustBar />
        <SellCta />
      </main>
      <Footer />
    </>
  );
}
