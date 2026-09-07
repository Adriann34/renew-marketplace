import Link from "next/link";
import { SignOutButton } from "@/components/auth/SignOutButton";

// "Account" trigger with a dropdown that reveals on hover (and keyboard focus, via
// group-focus-within) — the same sections as the account page, plus sign out.
// Pure CSS so it stays a server component; the trigger is still a real link to
// /account, which doubles as the tap target on touch devices (no hover there).

const itemClass =
  "block px-4 py-2.5 text-[13px] text-ink-dim hover:text-ink hover:bg-bg-inset transition-colors";

export function AccountMenu() {
  return (
    <div className="relative group hidden sm:block">
      <Link
        href="/account"
        className="inline-flex items-center gap-1 text-[13px] text-ink-dim group-hover:text-ink transition-colors py-2"
      >
        Account
        <svg
          className="w-2.5 h-2.5 transition-transform group-hover:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </Link>

      {/* pt-2 bridges the gap so moving from trigger to menu doesn't drop hover. */}
      <div className="absolute right-0 top-full pt-2 w-48 invisible translate-y-1 opacity-0 transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100 z-50">
        <div className="border border-line bg-bg-elevated rounded-xl overflow-hidden py-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]">
          <Link href="/account" className={itemClass}>
            Your listings
          </Link>
          <Link href="/account?tab=saved" className={itemClass}>
            Saved items
          </Link>
          <Link href="/account?tab=settings" className={itemClass}>
            Account settings
          </Link>
          <div className="h-px bg-line my-1" />
          <SignOutButton className="block w-full text-left px-4 py-2.5 text-[13px] text-danger hover:bg-danger/10 transition-colors" />
        </div>
      </div>
    </div>
  );
}
