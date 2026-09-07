import type { ReactNode } from "react";
import type { ConversationSummary } from "@/lib/conversations";
import { ConversationList } from "./ConversationList";

/**
 * Two-pane inbox layout. The conversation list is always rendered; the right pane
 * (`children`) holds either the open thread or an empty state. On mobile only one
 * pane shows at a time, driven by whether a conversation is active (each thread is
 * its own /messages/[id] route).
 */
export function MessagesShell({
  conversations,
  currentUserId,
  activeId,
  children,
}: {
  conversations: ConversationSummary[];
  currentUserId: string;
  activeId?: string;
  children: ReactNode;
}) {
  const hasActive = !!activeId;

  return (
    <div className="messages-shell">
      <aside
        className={`w-full lg:w-75 shrink-0 lg:border-r border-line flex-col min-h-0 ${
          hasActive ? "hidden lg:flex" : "flex"
        }`}
      >
        <ConversationList
          conversations={conversations}
          currentUserId={currentUserId}
          activeId={activeId}
        />
      </aside>

      <div className={`flex-1 min-w-0 ${hasActive ? "flex" : "hidden lg:flex"}`}>
        {children}
      </div>
    </div>
  );
}
