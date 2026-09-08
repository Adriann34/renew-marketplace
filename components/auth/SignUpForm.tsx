"use client";
import { FieldLabel, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "./GoogleSignInButton";

export function SignUpForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailTaken(false);
    setInfo(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", nextPath);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: callbackUrl.toString() },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.user?.identities?.length === 0) {
      setEmailTaken(true);
      return;
    }

    if (!data.session) {
      setInfo("Check your email to confirm your account, then sign in.");
      return;
    }

    router.replace(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      {emailTaken && (
        <p role="alert" className="text-[13px] text-danger">
          An account with this email already exists.{" "}
          <a href={`/signin?next=${encodeURIComponent(nextPath)}`} className="underline hover:text-ink transition-colors">
            Sign in instead
          </a>
          .
        </p>
      )}
      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
      {info && <p role="status" className="text-[13px] text-pass">{info}</p>}

      <div>
        <FieldLabel htmlFor="name">
          Name
        </FieldLabel>
        <Input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
        />
      </div>

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
        <FieldLabel htmlFor="password">
          Password
        </FieldLabel>
        <Input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      <div>
        <FieldLabel htmlFor="confirm-password">
          Confirm password
        </FieldLabel>
        <Input
          id="confirm-password"
          type="password"
          required
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
        {loading ? "Creating account…" : "Create account"}
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
