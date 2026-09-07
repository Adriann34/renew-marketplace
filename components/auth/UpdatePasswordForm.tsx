"use client";
import { FieldLabel, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LEN = 8;

export function UpdatePasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    // The recovery link already exchanged its code for a session (via
    // /auth/callback), so updateUser applies to the account being recovered.
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
    router.refresh();
    setTimeout(() => router.push("/account"), 1200);
  }

  if (done) {
    return (
      <div className="form-stack">
        <p role="status" className="form-notice text-pass">
          Password updated. Taking you to your account…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}

      <div>
        <FieldLabel htmlFor="password">
          New password
        </FieldLabel>
        <Input
          id="password"
          type="password"
          required
          minLength={MIN_PASSWORD_LEN}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <div>
        <FieldLabel htmlFor="confirm-password">
          Confirm new password
        </FieldLabel>
        <Input
          id="confirm-password"
          type="password"
          required
          minLength={MIN_PASSWORD_LEN}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
