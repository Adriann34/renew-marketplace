import { PageHeading } from "@/components/ui/PageHeading";
import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MessagesShell } from "@/components/messages/MessagesShell";
import { ChatThread, type ChatMessage } from "@/components/messages/ChatThread";
import { ContextPanel } from "@/components/messages/ContextPanel";
import { getConversationsForUser, getConversationById } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/signin?next=/messages/${id}`);

  const [conversations, active] = await Promise.all([
    getConversationsForUser(user.id),
    getConversationById(id, user.id),
  ]);
  // null when the conversation doesn't exist or the user isn't a participant —
  // don't leak which case it is.
  if (!active) notFound();

  const other = active.buyerId === user.id ? active.seller : active.buyer;
  const otherName = other.name ?? "Renew user";
  const thumbnailUrl =
    active.listing.photos.find((p) => p.kind === "CONDITION")?.url ??
    active.listing.photos[0]?.url ??
    null;

  const initialMessages: ChatMessage[] = active.messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    body: m.body,
    attachmentUrl: m.attachmentUrl,
    createdAt: m.createdAt,
  }));

  return (
    <div className="messages-page">
      <Navbar />

      <div className="market-container messages-heading"><PageHeading title="Messages" /></div>

      <main id="main-content" className="market-container messages-content">
        <MessagesShell conversations={conversations} currentUserId={user.id} activeId={id}>
          <div className="flex-1 flex min-w-0 min-h-0">
            <ChatThread
              conversationId={active.id}
              currentUserId={user.id}
              other={{ name: otherName, avatarUrl: other.avatarUrl }}
              listing={{
                id: active.listing.id,
                title: active.listing.title,
                price: active.listing.price,
                currency: active.listing.currency,
                category: active.listing.category,
                spec: active.listing.spec,
              }}
              initialMessages={initialMessages}
            />
            <ContextPanel
              listingId={active.listing.id}
              title={active.listing.title}
              price={active.listing.price}
              currency={active.listing.currency}
              category={active.listing.category}
              spec={active.listing.spec}
              thumbnailUrl={thumbnailUrl}
              returnTo={`/messages/${id}`}
            />
          </div>
        </MessagesShell>
      </main>
    </div>
  );
}
