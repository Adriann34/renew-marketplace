import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export function PageShell({ children, width = "default", className = "" }: {
  children: ReactNode;
  width?: "default" | "reading";
  className?: string;
}) {
  return <><Navbar /><main id="main-content" className={`market-container app-page app-page-${width} ${className}`}>{children}</main><Footer /></>;
}

