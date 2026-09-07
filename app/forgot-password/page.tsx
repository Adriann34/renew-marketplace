import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { createClient } from "@/lib/supabase/server";

export default async function ForgotPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <AuthLayout eyebrow="Reset password" title="Forgot your password?" description="Enter your email and we’ll send you a link to set a new one.">
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
