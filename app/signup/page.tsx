import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = safeInternalPath(next);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(nextPath);

  return (
    <AuthLayout eyebrow="Get started" title="Create your account">
      <SignUpForm nextPath={nextPath} />
      <p className="text-center text-[13px] text-ink-dim mt-8">Already have an account? <Link href={`/signin?next=${encodeURIComponent(nextPath)}`} className="text-ink underline underline-offset-4">Sign in</Link></p>
    </AuthLayout>
  );
}
