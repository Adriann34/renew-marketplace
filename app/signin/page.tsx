import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignInForm } from "@/components/auth/SignInForm";
import { createClient } from "@/lib/supabase/server";

export default async function SignInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <AuthLayout eyebrow="Welcome back" title="Sign in to Renew">
      <SignInForm />
      <p className="text-center text-[13px] text-ink-dim mt-8">Don’t have an account? <Link href="/signup" className="text-ink underline underline-offset-4">Sign up</Link></p>
    </AuthLayout>
  );
}
