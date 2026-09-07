import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import Link from "next/link";
import type { ConversationSummary } from "@/lib/conversations";
import { hasUnread } from "@/lib/conversations";
import { formatConversationTime, initialsFrom } from "@/lib/chatFormat";

function otherParticipant(conversation: ConversationSummary, currentUserId: string) {
  return conversation.buyerId === currentUserId ? conversation.seller : conversation.buyer;
}

function snippetFor(conversation: ConversationSummary, currentUserId: string): string {
  const last = conversation.messages[0];
  if (!last) return "No messages yet";
  const prefix = last.senderId === currentUserId ? "You: " : "";
  if (!last.body) return `${prefix}📷 Photo`;
  return `${prefix}${last.body}`;
}

export function ConversationList({
  conversations,
  currentUserId,
  activeId,
}: {
  conversations: ConversationSummary[];
  currentUserId: string;
  activeId?: string;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <EmptyState title="Start a conversation." action={<ButtonLink href="/browse" variant="secondary" size="small">Explore hardware</ButtonLink>}>Ask a seller about a part. Your conversations will appear here.</EmptyState>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => {
        const other = otherParticipant(conversation, currentUserId);
        const label = other.name ?? "Renew user";
        const unread = hasUnread(conversation, currentUserId);
        const last = conversation.messages[0];
        const isActive = conversation.id === activeId;

        return (
          <Link
            key={conversation.id}
            href={`/messages/${conversation.id}`}
            className="conversation-item"
            aria-current={isActive ? "page" : undefined}
          >
            <div className="avatar w-10 h-10">
              {other.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={other.avatarUrl} alt={label} className="w-full h-full object-cover" />
              ) : (
                initialsFrom(label)
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex justify-between gap-2 items-baseline">
                <span className={`text-[14px] truncate ${unread ? "font-semibold text-ink" : "font-medium"}`}>
                  {label}
                </span>
                {last && (
                  <span className="tabular-nums text-[11px] text-ink-dim shrink-0">
                    {formatConversationTime(new Date(last.createdAt))}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-ink-dim truncate my-1">
                {conversation.listing.title}
              </div>
              <div
                className={`text-[12.5px] truncate ${
                  unread ? "text-ink font-medium" : "text-ink-dim"
                }`}
              >
                {snippetFor(conversation, currentUserId)}
              </div>
            </div>

            {unread && <span className="w-2 h-2 rounded-full bg-accent shrink-0 mt-1.5" />}
          </Link>
        );
      })}
    </div>
  );
}
