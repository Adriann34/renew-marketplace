"use client";
import { FieldLabel, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    // The recovery email links back through the OAuth callback (which exchanges
    // the code for a session) and then on to /reset-password to set the new one.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setLoading(false);

    // Show the same confirmation whether or not the email exists — don't leak
    // which addresses have accounts.
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="form-stack">
        <p role="status" className="form-notice text-pass">
          If an account exists for <span className="font-medium">{email}</span>, a
          password reset link is on its way. Check your inbox.
        </p>
        <p className="text-[13px] text-ink-dim">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="text-ink hover:text-accent underline underline-offset-2 transition-colors"
          >
            try a different email
          </button>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}

      <div>
        <FieldLabel htmlFor="email">
          Email
        </FieldLabel>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-center text-[13px] text-ink-dim">
        Remembered it?{" "}
        <Link href="/signin" className="text-ink hover:text-accent transition-colors">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
