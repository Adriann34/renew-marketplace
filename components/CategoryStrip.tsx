import Link from "next/link";
import { categoryOrder, categoryPluralLabels } from "@/lib/category";

export function CategoryStrip() {
  return (
    <nav aria-label="Hardware categories" className="category-links">
      <Link href="/browse" className="category-link category-link-all">All hardware <span aria-hidden>→</span></Link>
      {categoryOrder.map((category) => (
        <Link key={category} href={`/browse?category=${category}`} className="category-link">
          {categoryPluralLabels[category]}
        </Link>
      ))}
    </nav>
  );
}
