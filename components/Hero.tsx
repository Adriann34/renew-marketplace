import { ButtonLink } from "@/components/ui/Button";
import Link from "next/link";
import Image from "next/image";

export function Hero() {
  return (
    <section className="home-hero" aria-labelledby="hero-heading">
      <div className="hero-stage">
        <div className="market-container hero-content">
          <div className="hero-copy">
            <p className="section-eyebrow">A new life for good hardware</p>
            <h1 id="hero-heading">Your next build<br />starts here</h1>
            <p className="hero-description">Discover used PC hardware. Find the right parts. Make something yours.</p>
            <div className="hero-actions">
              <ButtonLink href="/browse" >Explore hardware</ButtonLink>
              <Link href="/sell" className="hero-sell-link">Sell your hardware <span aria-hidden="true">→</span></Link>
            </div>
          </div>
          <div className="hero-artwork" role="img" aria-label="Editorial illustration of a silver graphics card, processor, and memory on a studio plinth">
            <Image
              className="hero-artwork-light"
              src="/renew-hardware-studio-light-v3.webp"
              alt=""
              fill
              sizes="(max-width: 1023px) 1280px, 100vw"
              quality={100}
              priority
            />
            <Image
              className="hero-artwork-dark"
              src="/renew-hardware-studio-dark-v3.webp"
              alt=""
              fill
              sizes="(max-width: 1023px) 1280px, 100vw"
              quality={100}
              priority
            />
          </div>
        </div>
        <div className="market-container hero-note"><span>Buy thoughtfully. Build beautifully.</span><span>Pre-owned. Full of possibility.</span></div>
      </div>
    </section>
  );
}
