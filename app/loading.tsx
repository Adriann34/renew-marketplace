import { Spinner } from "@/components/Spinner";

export default function Loading() {
  return <main id="main-content" className="market-container app-page flex items-center justify-center"><div role="status" className="flex items-center gap-3 text-[14px] text-ink-dim"><Spinner size={20} /><span>Loading Renew…</span></div></main>;
}
