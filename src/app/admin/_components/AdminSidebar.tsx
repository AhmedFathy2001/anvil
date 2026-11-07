'use client';

import { useState } from 'react';
import ClanLink, { useClanRelativePath } from '@/components/ClanLink';
import { Sprite, type SpriteName } from '@/components/ItemSlot';
import { SettingsSearchTrigger } from './AdminSettingsSearch';
import SupporterName from '@/components/SupporterName';
import type { SupporterStyle } from '@/lib/supporterStyle';
import type { SupporterTierId } from '@/lib/supporterTiers';

export interface SidebarItem {
  href: string;
  label: string;
  /** Emoji fallback. Ignored when `sprite` is set. */
  icon: string;
  /** An OSRS item sprite standing for the page (see components/ItemSlot). */
  sprite?: SpriteName;
  /** A number badge (hidden at 0) or a short word — 'read-only', '0 of 8', 'unpaid'. */
  badge?: number | string;
  /** Amber badge: this one is waiting on someone. */
  attn?: boolean;
  /** Reachable, but not part of the job at hand — an event's Payouts before it has ended. */
  quiet?: boolean;
  matchPrefix?: boolean; // highlight when pathname starts with href
  /** Sub-paths that have their own item, so this one shouldn't light up there too. */
  exclude?: string[];
  /** Other path prefixes that belong to this item — a hub whose tabs live at other addresses. */
  alsoMatch?: string[];
  /**
   * A hub's own pages, listed indented under it: always while you are inside the hub, and on demand
   * (the chevron) from anywhere else. A tabbed hub hides what it holds behind one word, so its tabs
   * are named here without each becoming a top-level item.
   */
  children?: SidebarChild[];
}

export interface SidebarChild {
  href: string;
  label: string;
  /** Lit only on exactly this path — the hub's first tab shares its address with the hub. */
  exact?: boolean;
}

export interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface Props {
  groups: SidebarGroup[];
  user?: {
    displayName: string;
    role: string;
    avatarUrl: string | null;
    /** Their Anvil Supporter flair, if they have one: the same star and colours they show everywhere else. */
    supporter?: { tier: SupporterTierId; style: SupporterStyle | null } | null;
  };
  /**
   * 'clan' is the shell's own nav. It hides itself inside a specific event, because that event's
   * layout renders its own rail — and it MUST be decided here, in a client component, rather than
   * in the shell layout: a parent layout doesn't re-render when you navigate between its children,
   * so a server-side decision would keep showing the first event you opened.
   */
  scope?: 'clan' | 'event';
  /** Event rails title themselves with the event rather than the signed-in user. */
  header?: { title: string; subtitle: string };
  /** The one "make something" action, above the groups — "+ New event". */
  primary?: { href: string; label: string };
  /** Where "Admin guide" at the foot of the rail goes. Omitted = no link. */
  guideHref?: string;
  /** The link's words — "Admin guide" for a clan, "Creator guide" for a creator space. */
  guideLabel?: string;
  /** Show the "Search settings" trigger (the dialog itself is mounted by the admin layout). */
  search?: boolean;
}

/** /admin/events/12, /admin/events/weekly/3 — a specific event, which brings its own rail. */
/**
 * `here` is `path` or a page under it — by whole path segments, so Clan settings (/admin/clan) is not
 * lit on Clan events (/admin/clan-events), which a plain startsWith matched.
 */
function under(here: string, path: string): boolean {
  return here === path || here.startsWith(path.endsWith('/') ? path : `${path}/`);
}

function isActive(here: string, item: SidebarItem): boolean {
  return (
    ((item.matchPrefix ? under(here, item.href) : here === item.href) || !!item.alsoMatch?.some((x) => under(here, x))) &&
    !item.exclude?.some((x) => under(here, x))
  );
}

function isInsideAnEvent(pathname: string): boolean {
  return /^\/admin\/events\/(weekly\/)?\d+(\/|$)/.test(pathname);
}

export default function AdminSidebar({ groups, user, scope = 'clan', header, primary, guideHref, guideLabel = 'Admin guide', search }: Props) {
  // Clan-relative, so a bare item.href can be compared to where we actually are.
  const here = useClanRelativePath();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Hubs opened by their chevron while you are elsewhere; inside a hub its pages always show.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (href: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return next;
    });

  // Clan-relative: the browser is at /c/<slug>/admin/events/12, and testing the raw pathname never
  // matched once clans moved under /c/ — so inside an event the clan nav stayed up beside the event's
  // own rail (two rails on desktop, two stacked "Menu" buttons on a phone).
  if (scope === 'clan' && isInsideAnEvent(here)) return null;

  return (
    <>
      {/* Mobile toggle — kept in normal document flow (it used to be `position: fixed` and floated
          over the page, covering each page's back-link / heading). As the first in-flow child it now
          sits cleanly above the content on small screens. */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden mb-4 inline-flex items-center gap-2 px-3 py-2 text-sm border border-card-border bg-card-bg rounded-lg"
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
          lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overscroll-contain
          [scrollbar-width:thin] [scrollbar-color:rgba(201,162,77,0.25)_transparent]
        `}
      >
        {/* The rail scrolls on its own: sticky under the header and capped to the screen, so a long
            rail no longer means scrolling the whole page to reach its foot. */}
        <div className="p-4 lg:p-0 lg:pr-3 lg:pb-4">
          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden mb-4 text-sm text-text-muted hover:text-foreground"
          >
            ← Close
          </button>

          {/* Who or what this rail is about */}
          {header ? (
            <div className="mb-4 p-3 rounded-xl border border-gold/25 bg-gold/[0.07]">
              <div className="text-sm font-semibold truncate text-gold-light">{header.title}</div>
              <div className="text-[10px] uppercase tracking-wide text-text-muted mt-0.5 truncate">
                {header.subtitle}
              </div>
            </div>
          ) : user ? (
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
              <div className="text-sm font-medium truncate">
                <SupporterName name={user.displayName} tier={user.supporter?.tier} style={user.supporter?.style} plain />
              </div>
              <div className="text-xs text-text-muted capitalize">{user.role}</div>
            </div>
          </div>
          ) : null}

          {search && <SettingsSearchTrigger onOpen={() => setMobileOpen(false)} />}

          {primary && (
            <ClanLink
              href={primary.href}
              onClick={() => setMobileOpen(false)}
              className="block text-center mb-5 px-4 py-2.5 rounded-lg border border-gold/35 bg-gold/10 text-gold font-semibold hover:bg-gold/15 transition-colors"
            >
              {primary.label}
            </ClanLink>
          )}

          <nav className="space-y-5">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="display italic text-[13px] text-text-dim px-3 mb-1.5">{group.label}</div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    // Compared clan-RELATIVE: item.href is a bare path and the browser is at
                    // /c/<slug>/… , so a direct comparison never matches and nothing looks active.
                    const active = isActive(here, item);
                    const kids = item.children ?? [];
                    const showKids = kids.length > 0 && (active || expanded.has(item.href));
                    return (
                      <li key={item.href} className={kids.length ? 'relative' : undefined}>
                        <ClanLink
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                            active
                              ? 'bg-gradient-to-r from-gold/15 to-gold/[0.02] text-gold-light border border-transparent shadow-[inset_3px_0_0_var(--gold)]'
                              : item.quiet
                                ? 'text-text-muted/55 hover:text-foreground hover:bg-brown-light border border-transparent'
                                : 'text-text-muted hover:text-foreground hover:bg-brown-light border border-transparent'
                          }`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            {item.sprite ? (
                              <span className={`w-[22px] h-[22px] grid place-items-center shrink-0 ${active ? '' : 'opacity-75 saturate-[.7]'}`}>
                                <Sprite name={item.sprite} className="max-w-[22px] max-h-[22px] w-auto h-auto" />
                              </span>
                            ) : (
                              <span className={active ? 'text-gold' : 'opacity-70'}>{item.icon}</span>
                            )}
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge != null && item.badge !== 0 && item.badge !== '' && (
                            <span
                              className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full whitespace-nowrap ${
                                item.attn
                                  ? 'bg-yellow-500/20 text-yellow-400'
                                  : 'bg-white/[0.06] text-text-muted'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {/* Room for the chevron, which sits over the row's right edge. */}
                          {kids.length > 0 && !active && <span aria-hidden="true" className="w-5 shrink-0" />}
                        </ClanLink>
                        {kids.length > 0 && !active && (
                          <button
                            type="button"
                            onClick={() => toggle(item.href)}
                            aria-expanded={showKids}
                            aria-label={`${showKids ? 'Hide' : 'Show'} the pages in ${item.label}`}
                            className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-md text-text-dim hover:bg-brown-light hover:text-gold"
                          >
                            <span aria-hidden="true" className={`text-base leading-none transition-transform ${showKids ? 'rotate-90' : ''}`}>›</span>
                          </button>
                        )}
                        {showKids && (
                          <ul className="mb-1 ml-[22px] mt-0.5 space-y-px border-l border-card-border pl-2.5">
                            {kids.map((kid) => {
                              const on = kid.exact ? here === kid.href : under(here, kid.href);
                              return (
                                <li key={kid.href}>
                                  <ClanLink
                                    href={kid.href}
                                    onClick={() => setMobileOpen(false)}
                                    aria-current={on ? 'page' : undefined}
                                    className={`block rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                                      on ? 'bg-gold/10 text-gold-light' : 'text-text-muted hover:bg-brown-light hover:text-foreground'
                                    }`}
                                  >
                                    {kid.label}
                                  </ClanLink>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {guideHref && (
            <ClanLink
              href={guideHref}
              onClick={() => setMobileOpen(false)}
              className="mt-6 flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-dashed border-tile-border text-sm text-text-muted hover:text-gold hover:border-gold/40 transition-colors"
            >
              <Sprite name="casket" className="w-[22px] h-auto" />
              {guideLabel}
            </ClanLink>
          )}
        </div>
      </aside>
    </>
  );
}
