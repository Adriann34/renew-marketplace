"use client";
import { Textarea } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";

import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SUPPORT_MESSAGE_CHARS } from "@/lib/supportChat";

/**
 * Sticky bottom-right support chatbot for the FAQ page (Messenger-style).
 *
 * A floating launcher toggles a chat panel. Only authenticated users can chat;
 * everyone else sees a sign-in prompt (the API route enforces this too — this is
 * just UX). Replies stream in token-by-token from /api/support/chat.
 *
 * Conversations are intentionally ephemeral: state lives here and is mirrored to
 * sessionStorage so it survives an in-session refresh, but nothing is stored
 * server-side and it clears when the tab closes.
 */

type ChatRole = "user" | "assistant";
type ChatMessage = { role: ChatRole; content: string };

const STORAGE_KEY = "renew-support-chat";

const WELCOME: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm Renew's support assistant. Ask me anything about buying, selling, grading, returns, or how the marketplace works.",
};

export function SupportChatWidget({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Hydrate prior in-session conversation after mount (avoids SSR mismatch).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
    } catch {
      // ignore corrupt/blocked storage
    }
  }, []);

  // Persist for the session (ephemeral — cleared when the tab closes).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore quota/private-mode errors
    }
  }, [messages]);

  // Keep the newest message in view.
  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, sending]);

  // Focus the composer when the panel opens.
  useEffect(() => {
    if (open && isAuthenticated) inputRef.current?.focus();
  }, [open, isAuthenticated]);

  // Abort any in-flight stream on unmount.
  useEffect(() => () => abortRef.current?.abort(), []);

  const closePanel = useCallback(() => setOpen(false), []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    const nextHistory: ChatMessage[] = [...messages, { role: "user", content: text }];
    // Add the user turn plus an empty assistant turn we stream tokens into.
    setMessages([...nextHistory, { role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setSending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/support/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Drop the welcome message and any trailing empty assistant slot before sending.
        body: JSON.stringify({
          messages: nextHistory
            .filter((m) => m !== WELCOME && m.content.trim().length > 0)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        throw new Error("Please sign in to chat with support.");
      }
      if (!res.ok || !res.body) {
        throw new Error("Support chat is unavailable right now. Please try again later.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      // Drop the empty assistant placeholder and surface an error line.
      setMessages((prev) => {
        const copy = [...prev];
        if (copy[copy.length - 1]?.role === "assistant" && !copy[copy.length - 1].content) copy.pop();
        return copy;
      });
      if ((err as Error).name !== "AbortError") {
        setError((err as Error).message || "Something went wrong. Please try again.");
      }
    } finally {
      setSending(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Launcher — sticky/fixed bottom-right */}
      <Button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close support chat" : "Open support chat"}
        aria-expanded={open}
        className="support-launcher"
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </Button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Renew support chat"
          className="support-panel"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-line shrink-0">
            <div className="w-9 h-9 rounded-full bg-accent-soft text-ink flex items-center justify-center shrink-0">
              <ChatIcon small />
            </div>
            <div className="min-w-0">
              <p className="font-display font-medium text-[15px] leading-tight">Renew Support</p>
              <p className="font-body text-[11px] text-ink-dim leading-tight">AI assistant · replies instantly</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close support chat"
              className="ml-auto ui-button ui-button-quiet ui-button-icon"
            >
              <CloseIcon />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex flex-col max-w-[85%] ${
                  m.role === "user" ? "self-end items-end" : "self-start items-start"
                }`}
              >
                <div
                  className={`message-bubble whitespace-pre-wrap ${m.role === "user" ? "message-bubble-mine" : ""}`}
                >
                  {m.content || (sending ? <TypingDots /> : null)}
                </div>
              </div>
            ))}
            {error && <p className="text-[12px] text-danger self-center text-center px-2">{error}</p>}
          </div>

          {/* Composer / sign-in gate */}
          {isAuthenticated ? (
            <div className="border-t border-line px-3 py-3 shrink-0">
              <div className="flex items-end gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_SUPPORT_MESSAGE_CHARS))}
                  onKeyDown={onKeyDown}
                  rows={1}
                  aria-label="Ask Renew support"
                  placeholder="Ask a question…"
                  className="flex-1 max-h-28"
                />
                <Button size="icon"
                  type="button"
                  onClick={send}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                >
                  <SendIcon />
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-line px-4 py-4 shrink-0 text-center">
              <p className="text-[13px] text-ink-dim mb-3">Sign in to chat with our support assistant.</p>
              <ButtonLink
                href="/signin"
              >
                Sign in
              </ButtonLink>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Assistant is typing">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-dim animate-bounce [animation-delay:-0.3s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-ink-dim animate-bounce [animation-delay:-0.15s]" />
      <span className="w-1.5 h-1.5 rounded-full bg-ink-dim animate-bounce" />
    </span>
  );
}

function ChatIcon({ small }: { small?: boolean }) {
  const s = small ? 18 : 24;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
