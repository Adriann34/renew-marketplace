"use client";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

import { useRef, useState } from "react";

// Kept in sync with MAX_CHAT_UPLOAD_BYTES in lib/chatUpload.ts (that module pulls in
// server-only deps, so we can't import it into this client component).
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function MessageComposer({
  onSend,
}: {
  onSend: (formData: FormData) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  function pickFile(selected: File | null) {
    setAttachError(null);
    if (preview) URL.revokeObjectURL(preview);
    if (!selected) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!selected.type.startsWith("image/")) {
      setAttachError("Only image attachments are supported.");
      return;
    }
    if (selected.size > MAX_ATTACHMENT_BYTES) {
      setAttachError("That image is over 10MB. Please choose a smaller one.");
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function submit() {
    const trimmed = text.trim();
    if ((!trimmed && !file) || sending) return;

    const formData = new FormData();
    formData.set("body", trimmed);
    if (file) formData.set("attachment", file);

    setSending(true);
    const ok = await onSend(formData);
    setSending(false);

    if (ok) {
      setText("");
      pickFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-line px-5 py-4 shrink-0">
      {attachError && (
        <p className="text-[12px] text-danger mb-2 px-1">{attachError}</p>
      )}

      {preview && (
        <div className="relative inline-block mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Attachment preview"
            className="max-h-28 rounded-xl border border-line"
          />
          <button
            type="button"
            onClick={() => {
              pickFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            aria-label="Remove attachment"
            className="absolute -top-2 -right-2 w-9 h-9 flex items-center justify-center rounded-full bg-ink text-bg text-[12px]"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex items-end gap-2.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach photo"
          className="ui-button ui-button-secondary ui-button-icon"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a5 5 0 01-7.07-7.07l9.19-9.19a3.5 3.5 0 015 5l-9.2 9.19a1.5 1.5 0 01-2.12-2.12l8.49-8.48" />
          </svg>
        </button>

        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoGrow();
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label="Message"
          placeholder="Write a message…"
          className="flex-1 min-h-12 max-h-30"
        />

        <Button size="icon"
          type="button"
          onClick={submit}
          disabled={sending || (!text.trim() && !file)}
          aria-label="Send message"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </Button>
      </div>
    </div>
  );
}
