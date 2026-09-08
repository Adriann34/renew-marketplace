"use client";
import { FieldLabel, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function SignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }
    router.replace(nextPath);
    router.refresh();
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

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <FieldLabel htmlFor="password">
            Password
          </FieldLabel>
          <Link
            href="/forgot-password"
            className="text-[12px] text-ink-dim hover:text-ink transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? "Signing in…" : "Sign in"}
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-line" />
        <span className="text-[12px] text-ink-dim">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <GoogleSignInButton nextPath={nextPath} />
    </form>
  );
}
