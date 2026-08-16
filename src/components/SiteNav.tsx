'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavUser {
  displayName: string;
  avatarUrl: string | null;
}

interface Props {
  signedIn: boolean;
  /** Live teams / captain seats / open sign-ups. 0 hides the My Team item entirely. */
  myTeams: number;
  isStaff: boolean;
  discordInvite: string | null;
  user: NavUser | null;
}

const DiscordIcon = (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
  </svg>
);

export default function SiteNav({ signedIn, myTeams, isStaff, discordInvite, user }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile menu on navigation so it never lingers over the next page.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = [
    { href: '/', label: 'Home' },
    // One entry for competitions. A Skill of the Week is an event, and having two links meant
    // knowing which table the clan filed something under before you could find it.
    { href: '/events', label: 'Events' },
    { href: '/members', label: 'Members' },
    ...(signedIn && myTeams > 0
      ? [{ href: '/team', label: myTeams > 1 ? `My Teams · ${myTeams}` : 'My Team' }]
      : []),
  ];

  const avatar = user?.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatarUrl} alt="" width={24} height={24} className="rounded-full" />
  ) : (
    <span className="w-6 h-6 rounded-full bg-gold/20 text-gold text-xs flex items-center justify-center font-semibold">
      {(user?.displayName || '?').charAt(0).toUpperCase()}
    </span>
  );

  return (
    <>
      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
          >
            {l.label}
          </Link>
        ))}
        {isStaff && (
          <Link
            href="/admin/dashboard"
            className="px-3 py-1.5 rounded-md text-sm text-gold/70 hover:text-gold hover:bg-gold/10 transition-all"
          >
            Admin
          </Link>
        )}
        {discordInvite && (
          <a
            href={discordInvite}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 px-3 py-1.5 rounded-md text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-1.5"
          >
            {DiscordIcon}
            Discord
          </a>
        )}
        {signedIn && user ? (
          <div className="ml-2 flex items-center gap-2 pl-3 border-l border-card-border">
            <Link
              href="/profile"
              className="flex items-center gap-2 group px-2 py-1 rounded-md hover:bg-brown-light transition-all"
              title={user.displayName}
            >
              {avatar}
              <span className="text-sm text-foreground/80 group-hover:text-foreground">
                {user.displayName}
              </span>
            </Link>
            <a
              href="/api/auth/logout?return=/"
              className="px-2 py-1 rounded-md text-xs text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
              title="Sign out"
            >
              ⎋
            </a>
          </div>
        ) : (
          <Link
            href="/login"
            className="ml-2 px-3 py-1.5 rounded-md text-sm bg-gold/10 text-gold hover:bg-gold/20 transition-all border border-gold/30"
          >
            Sign in
          </Link>
        )}
      </div>

      {/* Mobile: avatar shortcut + hamburger */}
      <div className="flex md:hidden items-center gap-1">
        {signedIn && user && (
          <Link href="/profile" className="p-1.5 rounded-md hover:bg-brown-light" title={user.displayName}>
            {avatar}
          </Link>
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="p-2 rounded-md text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
        >
          {open ? (
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="md:hidden absolute top-full inset-x-0 border-b-2 border-gold/20 bg-card-bg shadow-xl">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all"
              >
                {l.label}
              </Link>
            ))}
            {isStaff && (
              <Link
                href="/admin/dashboard"
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm text-gold/70 hover:text-gold hover:bg-gold/10 transition-all"
              >
                Admin
              </Link>
            )}
            {discordInvite && (
              <a
                href={discordInvite}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2.5 rounded-md text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-all flex items-center gap-1.5"
              >
                {DiscordIcon}
                Discord
              </a>
            )}
            <div className="border-t border-card-border mt-1 pt-2">
              {signedIn && user ? (
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-brown-light transition-all min-w-0"
                  >
                    {avatar}
                    <span className="text-sm text-foreground/80 truncate">{user.displayName}</span>
                  </Link>
                  <a
                    href="/api/auth/logout?return=/"
                    className="px-3 py-2 rounded-md text-sm text-text-muted hover:text-foreground hover:bg-brown-light transition-all shrink-0"
                  >
                    Sign out
                  </a>
                </div>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="block text-center px-3 py-2.5 rounded-md text-sm bg-gold/10 text-gold hover:bg-gold/20 transition-all border border-gold/30"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
