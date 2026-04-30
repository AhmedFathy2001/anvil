'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export interface SidebarItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
  matchPrefix?: boolean; // highlight when pathname starts with href
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface Props {
  groups: SidebarGroup[];
  user: {
    displayName: string;
    role: string;
    avatarUrl: string | null;
  };
}

export default function AdminSidebar({ groups, user }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-20 left-3 z-30 px-3 py-1.5 text-sm border border-card-border bg-card-bg rounded-lg shadow-lg"
        aria-label="Open admin menu"
      >
        ☰ Menu
      </button>

      {/* Backdrop on mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-40"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static top-0 left-0 h-screen lg:h-auto z-50 lg:z-auto
          w-72 lg:w-60 shrink-0 bg-card-bg border-r border-card-border
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:bg-transparent lg:border-r-0
          overflow-y-auto
        `}
      >
        <div className="lg:sticky lg:top-20 p-4 lg:p-0 lg:pr-4">
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden mb-4 text-sm text-text-muted hover:text-foreground"
          >
            ← Close
          </button>

          {/* User chip */}
          <div className="flex items-center gap-3 mb-4 p-3 rounded-xl border border-card-border bg-card-bg/60 lg:bg-card-bg">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" width={32} height={32} className="rounded-full" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-gold/20 text-gold flex items-center justify-center text-sm font-semibold">
                {user.displayName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{user.displayName}</div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted">{user.role}</div>
            </div>
          </div>

          <nav className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted/70 px-3 mb-1.5">
                  {group.label}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.matchPrefix
                      ? pathname.startsWith(item.href)
                      : pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            active
                              ? 'bg-gold/15 text-gold border border-gold/30'
                              : 'text-text-muted hover:text-foreground hover:bg-brown-light border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={active ? 'text-gold' : 'opacity-70'}>{item.icon}</span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge != null && item.badge > 0 && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-yellow-500/20 text-yellow-400">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
