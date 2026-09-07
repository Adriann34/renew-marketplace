import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";

const sections = [
  {
    id: "about",
    title: "About",
    body: [
      "Renew is a marketplace for buying and selling used PC hardware like GPUs, CPUs, and everything around them. Instead of relying on stock photos or seller claims, every listing carries a diagnostic report with a condition grade, benchmark score, and tested power draw, filled in by the seller and backed by photo proof.",
      "The goal is simple: make it possible to trust a used part before it ships, based on data instead of guesswork.",
    ],
  },
  {
    id: "contact",
    title: "Contact",
    body: [
      "This site is created and owned by Adrian Tan. You can reach out with questions, feedback, or bug reports at adriantanbusiness34@gmail.com.",
    ],
  },
];

export default function AboutPage() {
  return (
    <PageShell width="reading">
      <PageHeading eyebrow="Renew" title="Good hardware. Another chapter." description="A marketplace built around the details that matter." />
      <div className="editorial-sections">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="editorial-section">
            <h2 className="editorial-title">
              {section.title}
            </h2>
            <div className="space-y-4 text-ink-dim text-[15px] leading-relaxed">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
