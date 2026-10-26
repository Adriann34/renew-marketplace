import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeading } from "@/components/ui/PageHeading";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MessagesShell } from "@/components/messages/MessagesShell";
import { getConversationsForUser } from "@/lib/conversations";
import { createClient } from "@/lib/supabase/server";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin?next=/messages");

  const conversations = await getConversationsForUser(user.id);

  return (
    <div className="messages-page">
      <Navbar />

      <div className="market-container messages-heading"><PageHeading title="Messages" /></div>

      <main id="main-content" className="market-container messages-content">
        <MessagesShell conversations={conversations} currentUserId={user.id}>
          <div className="flex-1 flex items-center justify-center p-10 text-center">
            <EmptyState title="Select a conversation">Choose a conversation to view your messages.</EmptyState>
          </div>
        </MessagesShell>
      </main>
    </div>
  );
}
