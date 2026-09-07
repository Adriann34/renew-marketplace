import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";
import { createClient } from "@/lib/supabase/server";
import { faqSections } from "@/lib/supportKnowledge";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";

export default async function FaqPage() {
  // Only signed-in users can chat; the widget shows a sign-in prompt otherwise
  // (the /api/support/chat route enforces the same rule server-side).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <PageShell width="reading">
        <PageHeading eyebrow="Helpful to know" title="Frequently asked questions" description="A little more clarity for your next purchase or sale." />
          <div className="editorial-sections">
            {faqSections.map((section) => (
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

      <SupportChatWidget isAuthenticated={Boolean(user)} />
    </>
  );
}
