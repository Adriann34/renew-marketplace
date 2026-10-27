import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function BrowseLayout({ children }: { children: ReactNode }) {
  return <><Navbar />{children}<Footer /></>;
}
