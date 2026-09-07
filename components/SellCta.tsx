import Link from "next/link";

export function SellCta() {
  return (
    <section className="market-container sell-section" aria-labelledby="sell-heading">
      <div className="sell-panel">
        <div>
          <p className="section-eyebrow">Pass it on</p>
          <h2 id="sell-heading">Make room for your next upgrade.</h2>
          <p>Add your specs, share your photos, and find your hardware a new home.</p>
        </div>
        <Link href="/sell" className="market-button market-button-primary">List your hardware <span aria-hidden>↗</span></Link>
      </div>
    </section>
  );
}
