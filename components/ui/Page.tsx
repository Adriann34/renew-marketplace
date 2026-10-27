import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

type PageProps = {
  children: ReactNode;
  width?: "default" | "reading";
  className?: string;
};

export function PageContent({ children, width = "default", className = "" }: PageProps) {
  return <main id="main-content" className={`market-container app-page app-page-${width} ${className}`}>{children}</main>;
}

export function PageShell(props: PageProps) {
  return <><Navbar /><PageContent {...props} /><Footer /></>;
}

