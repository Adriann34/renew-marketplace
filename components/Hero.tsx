import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section className="home-hero">
      <div className="market-container hero-layout">
        <div className="hero-copy">
          <p className="section-eyebrow">The used hardware marketplace</p>
          <h1>Good hardware.<br /><span>A new beginning.</span></h1>
          <p className="hero-description">
            Buy and sell used PC hardware with clear specs, condition details,
            and seller photos.
          </p>
          <div className="hero-actions">
            <Link href="/browse" className="market-button market-button-primary">Browse hardware <span aria-hidden>↗</span></Link>
            <Link href="/sell" className="market-button market-button-secondary">Sell your hardware</Link>
          </div>
          <p className="hero-footnote">A second life for your next upgrade.</p>
        </div>
        <figure className="hero-product">
          <div className="hero-product-image">
            <Image
              src="/RTX_4090_home_page.png"
              alt="NVIDIA RTX 4090 Founders Edition graphics card on a dark surface"
              fill
              sizes="(max-width: 767px) calc(100vw - 40px), (max-width: 1023px) 48vw, 560px"
              className="object-cover"
              priority
            />
          </div>
          <figcaption><span>Built for the next build.</span><span>RTX 4090 · Founders Edition</span></figcaption>
        </figure>
      </div>
    </section>
  );
}
