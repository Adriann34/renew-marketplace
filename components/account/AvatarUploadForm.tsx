"use client";

import { useActionState, useRef } from "react";
import { updateAvatarAction, type UpdateAvatarState } from "@/app/account/actions";

const initialState: UpdateAvatarState = { error: null };

export function AvatarUploadForm({
  avatarUrl,
  initials,
}: {
  avatarUrl: string | null;
  initials: string;
}) {
  const [state, formAction, isPending] = useActionState(updateAvatarAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="flex items-center gap-4">
      <form ref={formRef} action={formAction} className="contents">
        <label className="avatar relative w-16 h-16 cursor-pointer group has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-accent">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile photo" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
          <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center justify-center text-center text-white text-[10px] font-body px-1 transition-opacity">
            {isPending ? "Uploading…" : "Change"}
          </span>
          <input
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            aria-label="Change profile photo"
            disabled={isPending}
            onChange={(e) => {
              if (e.target.files?.length) formRef.current?.requestSubmit();
            }}
          />
        </label>
      </form>
      <div>
        <p className="text-[13px] font-medium text-ink">Profile photo</p>
        <p className="text-[12px] text-ink-dim">JPEG, PNG, or WebP · up to 4MB</p>
        {state.error && <p className="text-[12px] text-danger mt-1">{state.error}</p>}
      </div>
    </div>
  );
}
