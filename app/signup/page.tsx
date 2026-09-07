import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { createClient } from "@/lib/supabase/server";

export default async function SignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <AuthLayout eyebrow="Get started" title="Create your account">
      <SignUpForm />
      <p className="text-center text-[13px] text-ink-dim mt-8">Already have an account? <Link href="/signin" className="text-ink underline underline-offset-4">Sign in</Link></p>
    </AuthLayout>
  );
}
