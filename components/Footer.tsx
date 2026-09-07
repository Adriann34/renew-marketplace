import Link from "next/link";

export function Footer() {
  return (
    <footer className="market-footer">
      <div className="market-container">
        <div className="footer-main">
          <div className="footer-brand">
            <Link href="/" className="market-wordmark" aria-label="Renew home">renew</Link>
            <p>Good hardware deserves another chapter.</p>
          </div>
          <nav aria-label="Footer marketplace">
            <h2>Marketplace</h2>
            <Link href="/browse?category=GPU">Graphics cards</Link>
            <Link href="/browse?category=CPU">Processors</Link>
            <Link href="/browse">All hardware</Link>
          </nav>
          <nav aria-label="Footer help">
            <h2>Helpful to know</h2>
            <Link href="/faq#how-grading-works">Condition & grading</Link>
            <Link href="/faq#buyer-protection">Buying on Renew</Link>
            <Link href="/faq#return-policy">Returns</Link>
          </nav>
          <nav aria-label="Footer company">
            <h2>Renew</h2>
            <Link href="/about#about">About us</Link>
            <Link href="/about#contact">Get in touch</Link>
            <Link href="/sell">Sell your hardware</Link>
          </nav>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Renew</span><span>Built for the next build.</span></div>
      </div>
    </footer>
  );
}
