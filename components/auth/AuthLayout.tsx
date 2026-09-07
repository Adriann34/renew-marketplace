import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/Page";
import { PageHeading } from "@/components/ui/PageHeading";

export function AuthLayout({ eyebrow, title, description, children }: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return <PageShell className="auth-page"><div className="auth-content"><PageHeading eyebrow={eyebrow} title={title} description={description} />{children}</div></PageShell>;
}
