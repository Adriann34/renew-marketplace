import Link from "next/link";

const items = [
  { title: "Know the condition", body: "Compare seller-provided grades and specs before you decide.", path: "M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3M9 3h6v4H9zM8 12h8M8 16h5" },
  { title: "See the evidence", body: "Look through condition photos and test results on the listing.", path: "M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 8h.01" },
  { title: "Talk to the seller", body: "Ask questions and arrange the details directly through messages.", path: "M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0ZM8 10h8M8 14h5" },
];

export function TrustBar() {
  return (
    <section className="market-container trust-section" aria-labelledby="trust-heading">
      <div className="section-heading">
        <h2 id="trust-heading">A closer look. A better decision.</h2>
        <Link href="/faq#how-grading-works" className="market-text-link">How it works <span aria-hidden>↗</span></Link>
      </div>
      <div className="trust-grid">
        {items.map((item) => (
          <div key={item.title} className="trust-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={item.path} /></svg>
            <h3>{item.title}</h3>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
