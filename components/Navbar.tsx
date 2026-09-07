import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountMenu } from "@/components/AccountMenu";
import { SearchBar } from "@/components/SearchBar";
import { MobileNav } from "@/components/MobileNav";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { getUnreadConversationCount } from "@/lib/conversations";

export async function Navbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // An unread-count failure should not prevent navigation from rendering.
  const unreadCount = user ? await getUnreadConversationCount(user.id).catch(() => 0) : 0;
  const messagesLabel = unreadCount > 0
    ? `Messages, ${unreadCount} unread conversation${unreadCount === 1 ? "" : "s"}`
    : "Messages";
  const messages = (
    <Link href="/messages" aria-label={messagesLabel} className="nav-messages">
      Messages
      {unreadCount > 0 && <span aria-hidden="true" className="nav-unread">{unreadCount > 9 ? "9+" : unreadCount}</span>}
    </Link>
  );

  return (
    <header className="market-header">
      <div className="market-container market-nav">
        <Link href="/" className="market-wordmark" aria-label="Renew home">re<span>new</span><span className="wordmark-dot" aria-hidden="true">.</span></Link>
        <Link href="/browse" className="desktop-browse">Browse</Link>
        <SearchBar />
        <div className="nav-actions">
          <div className="desktop-account">
            {user ? <>{messages}<AccountMenu /></> : <Link href="/signin">Sign in</Link>}
            <ThemeToggle />
          </div>
          <Link href="/sell" className="market-button market-button-primary nav-sell">List an item <span aria-hidden="true">+</span></Link>
          <MobileNav>
            <Link href="/browse">Browse hardware</Link>
            {user ? <>
              {messages}
              <Link href="/account">Your account</Link>
              <Link href="/account?tab=saved">Saved items</Link>
              <Link href="/account?tab=settings">Account settings</Link>
              <SignOutButton className="mobile-signout" />
            </> : <Link href="/signin">Sign in</Link>}
            <div className="mobile-theme"><span>Appearance</span><ThemeToggle /></div>
          </MobileNav>
        </div>
      </div>
    </header>
  );
}
