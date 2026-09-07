import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { UpdatePasswordForm } from "@/components/auth/UpdatePasswordForm";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Reaching here means the recovery link already established a session via
  // /auth/callback. Without one, there's nothing to reset — send them back to
  // request a fresh link (a stale/expired reset link lands here too).
  if (!user) redirect("/forgot-password");

  return (
    <AuthLayout eyebrow="Reset password" title="Set a new password" description="Choose a strong password you’re not using anywhere else.">
      <UpdatePasswordForm />
    </AuthLayout>
  );
}
