import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, children }: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return <header className="page-heading">
    <div>{eyebrow && <p className="section-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>
    {children && <div className="page-heading-actions">{children}</div>}
  </header>;
}

