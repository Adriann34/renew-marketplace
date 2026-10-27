"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Textarea } from "@/components/ui/Field";
import { Button, ButtonLink } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { MAX_SUPPORT_MESSAGE_CHARS, type SupportHistory, type SupportTranscript,
  type SupportTurnView, type SupportStreamEvent } from "@/lib/supportChat";

const EMPTY_HISTORY: SupportHistory = { conversations: [], nextCursor: null, currentConversationId: null };

class ChatLoadError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new ChatLoadError(data.error || "Support chat is unavailable. Please try again.", response.status);
  return data;
}

// Remount on identity changes so no transcript, draft, or pending response can
// carry over to a different account, including auth changes in another tab.
export function SupportChatWidget({ userId }: { userId: string | null }) {
  const [auth, setAuth] = useState({ id: userId, serverId: userId });
  const identity = auth.serverId === userId ? auth.id : userId;
  useEffect(() => {
    try { sessionStorage.removeItem("renew-support-chat"); } catch { /* Storage may be blocked. */ }
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setAuth({ id: session?.user.id ?? null, serverId: userId });
    });
    return () => subscription.unsubscribe();
  }, [userId]);
  return <SupportChatSession key={identity ?? "anonymous"} userId={identity} />;
}

function SupportChatSession({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<SupportHistory>(EMPTY_HISTORY);
  const [showHistory, setShowHistory] = useState(false);
  const [turns, setTurns] = useState<SupportTurnView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selection = useRef<{ id: string | null; explicit: boolean; history: boolean }>({ id: null, explicit: false, history: false });
  const revision = useRef(0);
  const sendingRef = useRef(false);
  const retryRef = useRef<SupportTurnView | null>(null);
  const loadAbort = useRef<AbortController | null>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prependScroll = useRef<{ height: number; top: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async (mode: "default" | "history" | "thread", cursor: string | null = null) => {
    if (sendingRef.current) return;
    const version = ++revision.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    setError(null);
    try {
      if (mode !== "thread") {
        const data = await getJson<SupportHistory>(`/api/support/conversations${cursor ? `?cursor=${cursor}` : ""}`, controller.signal);
        if (version !== revision.current) return;
        setHistory((previous) => cursor ? { ...data, conversations: [...previous.conversations,
          ...data.conversations.filter((item) => !previous.conversations.some((old) => old.id === item.id))] } : data);
        if (mode === "history") return;
        if (!selection.current.explicit) selection.current.id = data.currentConversationId;
        setFresh(!selection.current.id && data.conversations.length > 0);
      }
      const id = selection.current.id;
      if (!id) { setTurns([]); setNextCursor(null); return; }
      const data = await getJson<SupportTranscript>(`/api/support/conversations/${id}${cursor ? `?cursor=${cursor}` : ""}`, controller.signal);
      if (version !== revision.current) return;
      if (cursor && scrollRef.current) prependScroll.current = { height: scrollRef.current.scrollHeight, top: scrollRef.current.scrollTop };
      setTurns((previous) => cursor ? [...data.turns.filter((item) => !previous.some((old) => old.id === item.id)), ...previous] : data.turns);
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (!controller.signal.aborted && version === revision.current) {
        if (err instanceof ChatLoadError && err.status === 404 && mode !== "history") {
          selection.current.id = null;
          selection.current.explicit = true;
          retryRef.current = null;
          setTurns([]); setNextCursor(null);
        }
        setError((err as Error).message);
      }
    } finally {
      if (version === revision.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !userId) return;
    load("default");
    const onFocus = () => load(selection.current.history ? "history" : "default");
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [open, userId, load]);

  useEffect(() => () => {
    revision.current++;
    loadAbort.current?.abort();
    streamAbort.current?.abort();
  }, []);

  // Poll only while another tab/server request is preparing a reply. Stale
  // attempts become retryable after the server's bounded generation lease.
  const pending = turns.some((turn) => turn.status === "PENDING");
  useEffect(() => {
    if (!open || showHistory || sending || !pending) return;
    const timer = setTimeout(() => load("thread"), 3000);
    return () => clearTimeout(timer);
  }, [open, showHistory, sending, pending, turns, load]);

  useEffect(() => {
    const panel = scrollRef.current;
    if (!open || showHistory || !panel) return;
    if (prependScroll.current) {
      panel.scrollTop = prependScroll.current.top + panel.scrollHeight - prependScroll.current.height;
      prependScroll.current = null;
    } else panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
  }, [open, turns, showHistory]);
  useEffect(() => {
    if (open && userId && !showHistory && !loading && !sending) inputRef.current?.focus();
  }, [open, userId, showHistory, loading, sending]);

  const closePanel = useCallback(() => { setOpen(false); launcherRef.current?.focus(); }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") closePanel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePanel]);

  function newChat() {
    revision.current++;
    loadAbort.current?.abort();
    selection.current = { id: null, explicit: true, history: false };
    retryRef.current = null;
    prependScroll.current = null;
    setTurns([]); setInput(""); setError(null); setNextCursor(null);
    setShowHistory(false); setLoading(false); setFresh(false);
  }

  function openThread(id: string) {
    selection.current = { id, explicit: true, history: false };
    retryRef.current = null;
    prependScroll.current = null;
    setInput(""); setTurns([]); setNextCursor(null); setFresh(false); setShowHistory(false);
    load("thread");
  }

  async function send(retry?: SupportTurnView) {
    const text = (retry?.question ?? input).trim();
    if (!text || sendingRef.current || loading || pending) return;
    const previous = retry ?? (retryRef.current?.question === text ? retryRef.current : null);
    const turn: SupportTurnView = { id: previous?.id ?? crypto.randomUUID(), question: text,
      answer: null, status: "PENDING", createdAt: previous?.createdAt ?? new Date().toISOString() };
    const version = ++revision.current;
    loadAbort.current?.abort();
    const controller = new AbortController();
    streamAbort.current = controller;
    sendingRef.current = true;
    setSending(true); setError(null); setFresh(false);
    setTurns((current) => current.some((item) => item.id === turn.id)
      ? current.map((item) => item.id === turn.id ? turn : item) : [...current, turn]);
    try {
      const response = await fetch("/api/support/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ conversationId: selection.current.id, requestId: turn.id, message: text }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Support chat is unavailable. Please try again.");
      }
      if (!response.body) throw new Error("The reply was interrupted. Please retry your question.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let completed = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          if (version !== revision.current) return;
          const data = JSON.parse(event.slice(6)) as SupportStreamEvent;
          if (data.type === "start") selection.current.id = data.conversationId;
          if (data.type === "delta") {
            answer += data.text;
            setTurns((current) => current.map((item) => item.id === turn.id ? { ...item, answer } : item));
          }
          if (data.type === "done") {
            completed = true;
            setTurns((current) => current.map((item) => item.id === turn.id ? data.turn : item));
          }
          if (data.type === "error") throw new Error(data.message);
        }
      }
      if (!completed) throw new Error("The reply was interrupted. Please retry your question.");
      if (version === revision.current) {
        retryRef.current = null;
        selection.current.explicit = false;
        setInput("");
      }
    } catch (err) {
      if (version === revision.current && !controller.signal.aborted) {
        retryRef.current = turn;
        setTurns((current) => current.map((item) => item.id === turn.id ? { ...turn, status: "FAILED" } : item));
        setInput(text);
        setError((err as Error).message);
      }
    } finally {
      if (version === revision.current) {
        sendingRef.current = false; setSending(false); streamAbort.current = null;
      }
    }
  }

  return <>
    <Button ref={launcherRef} size="icon" onClick={() => setOpen((value) => !value)}
      aria-label={open ? "Close support chat" : "Open support chat"} aria-expanded={open} className="support-launcher">
      {open ? <CloseIcon /> : <ChatIcon />}
    </Button>
    {open && <div role="dialog" aria-label="Renew support chat" className="support-panel">
      <div className="flex items-center gap-2 px-3 py-3 border-b border-line shrink-0">
        <div className="hidden min-[400px]:flex w-9 h-9 rounded-full bg-accent-soft text-ink items-center justify-center shrink-0">
          {showHistory ? <HistoryIcon /> : <ChatIcon small />}
        </div>
        <div className="min-w-0 flex-1"><p className="font-medium text-[15px] leading-tight truncate">{showHistory ? "History" : "Renew Support"}</p>
          {!showHistory && <p className="text-[11px] text-ink-dim leading-tight">AI assistant</p>}</div>
        <div className="flex items-center shrink-0">
          {userId && <>
            <Button variant="quiet" size="icon" disabled={sending}
              aria-label={showHistory ? "Back to chat" : "History"} title={showHistory ? "Back to chat" : "History"}
              onClick={() => {
                selection.current.history = !showHistory;
                setShowHistory(!showHistory);
                load(showHistory ? "thread" : "history");
              }}>{showHistory ? <BackIcon /> : <HistoryIcon />}</Button>
            <Button variant="quiet" size="icon" disabled={sending} onClick={newChat} aria-label="New chat" title="New chat"><ComposeIcon /></Button>
          </>}
          <Button variant="quiet" size="icon" onClick={closePanel} aria-label="Close support chat" title="Close support chat"><CloseIcon /></Button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {showHistory ? <>
          {!loading && history.conversations.length === 0 && <p className="text-sm text-ink-dim">Your conversations will appear here after you send your first message.</p>}
          {history.conversations.map((item) => <button key={item.id} type="button" onClick={() => openThread(item.id)}
            className="text-left py-3 border-b border-line hover:text-accent focus-visible:outline-2 focus-visible:outline-accent">
            <span className="block text-sm truncate">{item.title}</span>
            <time dateTime={item.lastMessageAt} className="block mt-1 text-xs text-ink-dim">{new Date(item.lastMessageAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time>
          </button>)}
          {history.nextCursor && <Button variant="quiet" size="small" disabled={loading} onClick={() => load("history", history.nextCursor)}>Older conversations</Button>}
        </> : <>
          {nextCursor && <Button variant="quiet" size="small" disabled={loading || sending} onClick={() => load("thread", nextCursor)}>Earlier messages</Button>}
          {fresh && <p className="text-xs text-ink-dim text-center">Your previous chat is available in History.</p>}
          {!nextCursor && <Bubble mine={false}>Hi! How can I help you?</Bubble>}
          <div role="log" aria-label="Support messages" aria-live="polite" aria-busy={sending || pending} className="flex flex-col gap-3">
            {turns.map((turn, index) => <div key={turn.id} className="flex flex-col gap-3">
              <Bubble mine>{turn.question}</Bubble>
              {turn.status !== "FAILED" && <Bubble mine={false}>{turn.answer || <TypingDots />}</Bubble>}
              {turn.status === "FAILED" && <div className="text-xs text-ink-dim self-start">
                Reply interrupted.
                {index === turns.length - 1 && <Button variant="quiet" size="small" disabled={sending || loading || pending}
                  onClick={() => send(turn)}>Retry question</Button>}
              </div>}
            </div>)}
          </div>
        </>}
        {loading && <p role="status" className="text-xs text-ink-dim text-center">Loading conversations…</p>}
        {error && <div role="alert" className="text-xs text-danger text-center">
          <p>{error}</p>
          {!sending && <Button variant="quiet" size="small" onClick={() => load(showHistory ? "history" : "default")}>Reload chat</Button>}
        </div>}
      </div>
      {userId ? <div className="border-t border-line px-3 py-3 shrink-0">
        {!showHistory && <div className="flex items-end gap-2">
          <Textarea ref={inputRef} value={input} disabled={sending || loading || pending}
            onChange={(event) => { setInput(event.target.value.slice(0, MAX_SUPPORT_MESSAGE_CHARS)); selection.current.explicit = true; }}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
            rows={1} aria-label="Ask Renew support" placeholder="Ask a question…" className="flex-1 max-h-28" />
          <Button size="icon" onClick={() => send()} disabled={!input.trim() || sending || loading || pending} aria-label="Send message"><SendIcon /></Button>
        </div>}
        <p className="text-[10px] text-ink-dim text-center mt-2">Chats are saved for 30 days after their last message.</p>
      </div> : <div className="border-t border-line px-4 py-4 shrink-0 text-center">
        <p className="text-[13px] text-ink-dim mb-3">Sign in to chat with our support assistant.</p><ButtonLink href="/signin">Sign in</ButtonLink>
      </div>}
    </div>}
  </>;
}

function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return <div className={`flex flex-col max-w-[85%] ${mine ? "self-end items-end" : "self-start items-start"}`}>
    <div className={`message-bubble whitespace-pre-wrap break-words ${mine ? "message-bubble-mine" : ""}`}>{children}</div>
  </div>;
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
    <svg className="shrink-0" width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11a9 9 0 1 1 2.7 7.4M3 4v7h7" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 19-7-7 7-7M5 12h14" />
    </svg>
  );
}

function ComposeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="m16 3 5 5M21 3a2.12 2.12 0 0 1 0 3L11 16l-4 1 1-4L18 3a2.12 2.12 0 0 1 3 0Z" />
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
