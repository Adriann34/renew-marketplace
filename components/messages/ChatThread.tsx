"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendMessageAction, markReadAction } from "@/app/messages/actions";
import { Price } from "@/components/Price";
import { formatMessageTime, formatDayDivider, initialsFrom } from "@/lib/chatFormat";
import { MessageComposer } from "./MessageComposer";

export type ChatMessage = {
  id: string;
  senderId: string;
  body: string;
  attachmentUrl: string | null;
  createdAt: Date;
  pending?: boolean;
};

type ListingContext = {
  id: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  spec: string;
};

export function ChatThread({
  conversationId,
  currentUserId,
  other,
  listing,
  initialMessages,
}: {
  conversationId: string;
  currentUserId: string;
  other: { name: string; avatarUrl: string | null };
  listing: ListingContext;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Mark read on open, and re-subscribe whenever we switch conversations.
  useEffect(() => {
    setMessages(initialMessages);
    markReadAction(conversationId);

    const supabase = createClient();
    const channel = supabase.channel(`conversation:${conversationId}`);

    (async () => {
      // Realtime respects RLS — hand it the user's access token so it authorizes
      // the subscription against the msg_participant_read policy.
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);

      channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "Message",
            filter: `conversationId=eq.${conversationId}`,
          },
          (payload) => {
            const row = payload.new as {
              id: string;
              senderId: string;
              body: string;
              attachmentUrl: string | null;
              createdAt: string;
            };
            // Our own messages are already shown optimistically; only append the
            // other participant's, and guard against duplicate deliveries.
            if (row.senderId === currentUserId) return;
            setMessages((prev) =>
              prev.some((m) => m.id === row.id)
                ? prev
                : [
                    ...prev,
                    {
                      id: row.id,
                      senderId: row.senderId,
                      body: row.body,
                      attachmentUrl: row.attachmentUrl,
                      createdAt: new Date(row.createdAt),
                    },
                  ]
            );
            markReadAction(conversationId);
          }
        )
        .subscribe();
    })();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, initialMessages]);

  // Keep the view pinned to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function handleSend(formData: FormData): Promise<boolean> {
    setError(null);
    const body = String(formData.get("body") ?? "").trim();
    const attachment = formData.get("attachment");
    const previewUrl =
      attachment instanceof File && attachment.size > 0
        ? URL.createObjectURL(attachment)
        : null;

    const tempId = `temp-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: currentUserId,
        body,
        attachmentUrl: previewUrl,
        createdAt: new Date(),
        pending: true,
      },
    ]);

    const result = await sendMessageAction(conversationId, formData);

    if ("error" in result) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setError(result.error);
      return false;
    }

    const real = result.message;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === tempId
          ? {
              id: real.id,
              senderId: real.senderId,
              body: real.body,
              attachmentUrl: real.attachmentUrl,
              createdAt: new Date(real.createdAt),
            }
          : m
      )
    );
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    return true;
  }

  return (
    <section className="flex-1 flex flex-col min-w-0 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
        <Link
          href="/messages"
          className="lg:hidden flex items-center justify-center w-11 h-11 rounded-full text-ink-dim hover:text-ink"
          aria-label="Back to conversations"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <div className="avatar w-10 h-10">
          {other.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={other.avatarUrl} alt={other.name} className="w-full h-full object-cover" />
          ) : (
            initialsFrom(other.name)
          )}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-[15px] truncate">{other.name}</p>
        </div>
      </div>

      {/* Listing context strip */}
      <Link
        href={`/listing/${listing.id}?from=${encodeURIComponent(`/messages/${conversationId}`)}`}
        className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line shrink-0 hover:bg-bg-inset transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium truncate">{listing.title}</p>
          <p className="font-body text-[11.5px] text-ink-dim truncate">
            {listing.category} · {listing.spec}
          </p>
        </div>
        <span className="shrink-0">
          <Price amount={listing.price} currency={listing.currency} align="right" className="font-bold text-[14px]" />
        </span>
        <span className="text-[12.5px] font-medium text-accent shrink-0">View</span>
      </Link>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-6 flex flex-col gap-3">
        {messages.map((m, i) => {
          const mine = m.senderId === currentUserId;
          const prev = messages[i - 1];
          const showDivider =
            !prev || new Date(prev.createdAt).toDateString() !== m.createdAt.toDateString();
          // Persisted attachments are private: fetch them through the authorized route
          // by message id. Pending sends still show the local blob preview.
          const attachmentSrc = m.attachmentUrl
            ? m.pending
              ? m.attachmentUrl
              : `/api/chat-attachment/${m.id}`
            : null;

          return (
            <div key={m.id} className="contents">
              {showDivider && (
                <div className="text-center font-body text-[11px] text-ink-dim my-2">
                  {formatDayDivider(m.createdAt)}
                </div>
              )}
              <div className={`flex flex-col max-w-[75%] sm:max-w-[62%] ${mine ? "self-end items-end" : "self-start items-start"}`}>
                <div
                  className={`message-bubble ${mine ? "message-bubble-mine" : ""} ${m.pending ? "opacity-60" : ""}`}
                >
                  {attachmentSrc && (
                    <a href={attachmentSrc} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={attachmentSrc}
                        alt="Attachment"
                        className={`max-w-full max-h-64 rounded-xl ${m.body ? "mb-1.5" : ""}`}
                      />
                    </a>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                </div>
                <span className="tabular-nums text-[11px] text-ink-dim mt-1 px-0.5">
                  {m.pending ? "Sending…" : formatMessageTime(m.createdAt)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <p className="text-[12px] text-danger px-4 py-1.5 border-t border-line">{error}</p>
      )}

      <MessageComposer onSend={handleSend} />
    </section>
  );
}
