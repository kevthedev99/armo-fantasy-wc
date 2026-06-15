"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_MAX_LENGTH, CHAT_POLL_MS, type ChatMessage } from "@/lib/chat";
import { formatPSTTime } from "@/lib/match-status";

interface ChatPageProps {
  username: string;
}

function ChatLine({ message }: { message: ChatMessage }) {
  const time = formatPSTTime(message.created_at);

  return (
    <div className="break-words px-3 py-1 leading-snug hover:bg-white/5">
      <span className="mr-2 text-[11px] text-gray-500">{time}</span>
      <span className="mr-2 font-bold text-[#FFD700]">{message.username}</span>
      <span className="text-gray-100">{message.body}</span>
    </div>
  );
}

export function ChatPage({ username }: ChatPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      const res = await fetch("/api/chat");
      const data = await res.json();
      if (cancelled) return;

      if (!res.ok) {
        setError(data.error ?? "Could not load chat.");
        setLoading(false);
        return;
      }

      setError(null);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setLoading(false);

      if (stickToBottom.current) {
        requestAnimationFrame(scrollToBottom);
      }
    }

    void poll();
    const interval = setInterval(() => void poll(), CHAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [scrollToBottom]);

  async function refreshAfterSend() {
    const res = await fetch("/api/chat");
    const data = await res.json();
    if (!res.ok) return;
    setMessages(Array.isArray(data.messages) ? data.messages : []);
    requestAnimationFrame(scrollToBottom);
  }

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    stickToBottom.current = nearBottom;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const data = await res.json();

    setSending(false);

    if (!res.ok) {
      setError(data.error ?? "Could not send message.");
      return;
    }

    setDraft("");
    stickToBottom.current = true;
    if (data.message) {
      setMessages((prev) => [...prev, data.message as ChatMessage]);
      requestAnimationFrame(scrollToBottom);
    } else {
      await refreshAfterSend();
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-[#0e0e10] text-white">
      <header className="border-b border-white/10 bg-[#18181b] px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          <h1 className="text-2xl font-black uppercase tracking-tight text-white md:text-3xl">
            Chat
          </h1>
          <span className="rounded-full bg-[#FF007A]/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF007A]">
            Beta
          </span>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-sm text-gray-400">
          Session chat for the league. Logged in as{" "}
          <span className="font-semibold text-[#FFD700]">{username}</span>.
        </p>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-0 md:px-4">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto py-2 font-mono text-sm"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {loading && (
            <p className="px-3 py-8 text-center text-gray-500">Loading chat…</p>
          )}
          {messages.map((message) => (
            <ChatLine key={message.id} message={message} />
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-white/10 bg-[#18181b] p-3 md:rounded-t-lg"
        >
          {error && (
            <p className="mb-2 text-center text-xs text-[#FF007A]">{error}</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={CHAT_MAX_LENGTH}
              placeholder="Send a message…"
              className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#0e0e10] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-[#0056b3] focus:outline-none"
              autoComplete="off"
              spellCheck
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="shrink-0 rounded-lg bg-[#0056b3] px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#004494] disabled:opacity-40"
            >
              Chat
            </button>
          </div>
          <p className="mt-1.5 text-right text-[10px] text-gray-500">
            {draft.length}/{CHAT_MAX_LENGTH}
          </p>
        </form>
      </div>
    </div>
  );
}
