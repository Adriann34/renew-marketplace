import type { ReactNode } from "react";

export function ListingImage({ src, title, verified = false, children }: {
  src?: string | null;
  title: string;
  verified?: boolean;
  children?: ReactNode;
}) {
  return <div className="listing-image">
    {src ? <img src={src} alt={title} loading="lazy" decoding="async" /> : <div className="listing-image-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4M9 9h6v6H9z" /></svg>
      <span>Photo not provided</span>
    </div>}
    {verified && <span className="listing-verified"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3.5 8 3 3 6-6" /></svg>Photo verified</span>}
    {children}
  </div>;
}
