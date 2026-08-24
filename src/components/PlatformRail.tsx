'use client';

import { usePathname } from 'next/navigation';

import ClanLink from '@/components/ClanLink';
import ClanCrest from '@/components/ClanCrest';

export interface RailClan {
  slug: string;
  name: string;
  /** Something is running there right now — the one thing worth a dot in a nav. */
  live?: boolean;
}

/**
 * The platform's own navigation, on the apex.
 *
 * STICKY, not scrolling away. This is how you move between clans, so it has to be reachable from
 * anywhere on a long page — including the bottom of the landing. It owns its own scrollbar for the
 * case where somebody's clan list plus the nav is taller than their screen.
 *
 * RESPONSIVE BY CHANGING SHAPE, not by hiding. Below `lg` it becomes a horizontal scrollable top
 * bar that still shows your clans, because "which clans am I in" is the thing this rail exists to
 * answer and a hamburger hides exactly that.
 *
 * It turns into the sidebar at `lg`, not `md`. At 768 a 240px rail takes a third of the screen and
 * leaves the page 528 — narrower than the phone layout it just stopped using.
 *
 * There used to be one nav and it was a clan's — so the apex offered Events and Members, which 404
 * there because the apex has no roster. This is the other half of that split: the rail is what the
 * PLATFORM has, and a clan's pages keep the top nav they always had.
 *
 * Every destination here is a platform path, so ClanLink passes them through untouched — which is
 * why the rule forbidding bare next/link has no exception for "I know this one is safe". It caught
 * this file when it was first written with Link.
 */
export default function PlatformRail({
  clans,
  signedIn,
  displayName,
  characterCount,
  platformStaff,
}: {
  clans: RailClan[];
  signedIn: boolean;
  displayName: string | null;
  characterCount?: number;
  /** Holds a platform role. A separate axis from any clan grant — see lib/clanRoles. */
  platformStaff?: boolean;
}) {
  const pathname = usePathname() ?? '/';

  const item = (href: string, label: string, icon: React.ReactNode) => {
    // Exact match for the root, prefix match for the rest, so /clans/new keeps Clans lit.
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
      <ClanLink
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors ${
          active
            ? 'bg-gold/[0.09] text-gold shadow-[inset_2px_0_0_var(--gold)]'
            : 'text-text-muted hover:bg-brown-light hover:text-foreground'
        }`}
      >
        <span className={`shrink-0 ${active ? 'text-gold' : 'text-text-dim'}`}>{icon}</span>
        {label}
      </ClanLink>
    );
  };

  return (
    // `self-start` is for the DESKTOP row, where it stops the rail stretching to the page's height.
    // Applied at every width it also cancels the mobile column's stretch, so the bar sized itself to
    // its own content — 539px of clans against a 422px screen — and dragged the whole page sideways
    // with it. Cross-axis alignment means opposite things in the two directions this flips between.
    <nav className="sticky top-0 z-40 flex w-full shrink-0 gap-4 overflow-x-auto border-b border-card-border bg-brown-dark p-2 lg:h-screen lg:w-[240px] lg:flex-col lg:gap-6 lg:self-start lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-4">
      {/* THE LOGO IS THE ARTWORK, not the drawn path. `AnvilMark` exists so the mark can be a 600px
          watermark without going to mush — that is a background job. Where the logo is acting as the
          logo, the real icon wins: it is what sits in the browser tab and in everybody's bookmarks,
          and a site whose header mark and favicon are two different drawings looks unfinished. */}
      <ClanLink href="/" className="group flex shrink-0 items-center gap-2.5 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-48.png" alt="" width={26} height={26} className="shrink-0 rounded-md" />
        <span className="display hidden text-[18px] font-semibold text-gold lg:inline">Anvil</span>
      </ClanLink>

      <div className="flex shrink-0 gap-0.5 lg:flex-col">
        <div className="hidden px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim lg:block">
          Platform
        </div>
        {item('/', 'Home', <HomeIcon />)}
        {item('/clans', 'Find a clan', <SearchIcon />)}
        {item('/leaderboard', 'Records', <ChartIcon />)}
        {item('/guide', 'Guides', <BookIcon />)}
        {/* /staff existed and NOTHING linked to it. Platform capability is its own axis — no clan
            role confers it — so an operator had to know the URL to reach the platform's own admin. */}
        {platformStaff && item('/staff', 'Platform', <ShieldIcon />)}
      </div>

      {clans.length > 0 && (
        <div className="flex min-h-0 shrink-0 gap-0.5 lg:flex-col">
          <div className="hidden items-center gap-2 px-2.5 pb-1.5 lg:flex">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
              Your clans
            </span>
            <span className="font-mono text-[10px] text-text-dim/70">{clans.length}</span>
          </div>
          {/* Capped and scrolling: guesting into other clans' events is meant to be ordinary, so a
              dozen seats is a normal account. A rail listing all of them pushes the nav off screen. */}
          <div className="flex gap-0.5 lg:max-h-[min(34vh,320px)] lg:flex-col lg:overflow-y-auto">
            {clans.map((c) => (
              <ClanLink
                key={c.slug}
                href={`/c/${c.slug}`}
                className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13.5px] text-text-muted transition-colors hover:bg-brown-light hover:text-foreground"
              >
                <ClanCrest name={c.name} size={18} />
                <span className="truncate">{c.name}</span>
                {c.live && (
                  <span
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-green-light"
                    title="Something is running"
                  />
                )}
              </ClanLink>
            ))}
          </div>
        </div>
      )}

      {/* The way out. The first cut of this rail had no sign-out at all, because it lived in the
          clan nav that the apex no longer renders. */}
      <div className="ml-auto flex shrink-0 items-center gap-2.5 pl-2 lg:ml-0 lg:mt-auto lg:border-t lg:border-card-border-soft lg:pt-3">
        {signedIn ? (
          <>
            <ClanLink href="/profile" className="group flex min-w-0 items-center gap-2.5">
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#4a3b2a] to-[#2a211a] text-[11px] font-semibold text-gold">
                {(displayName ?? '?').charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 text-[13px] group-hover:text-gold">
                <span className="block truncate">{displayName ?? 'You'}</span>
                {characterCount != null && (
                  <span className="hidden font-mono text-[10.5px] text-text-dim lg:block">
                    {characterCount} character{characterCount === 1 ? '' : 's'}
                  </span>
                )}
              </span>
            </ClanLink>
            {/* clan-prefix: platform — /api/auth/logout is the platform's, and signing out has to be
                a real navigation rather than a client-side route. */}
            <a
              href="/api/auth/logout?return=/"
              title="Sign out"
              aria-label="Sign out"
              className="ml-auto shrink-0 rounded-md p-1.5 text-text-dim transition-colors hover:bg-brown-light hover:text-accent-red"
            >
              <SignOutIcon />
            </a>
          </>
        ) : (
          item('/login', 'Sign in', <PersonIcon />)
        )}
      </div>
    </nav>
  );
}

const s = {
  width: 15,
  height: 15,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
} as const;

const HomeIcon = () => <svg {...s}><path d="M2 7l6-4.5L14 7v6.5a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" /></svg>;
const SearchIcon = () => <svg {...s}><circle cx="7" cy="7" r="4.4" /><path d="M10.4 10.4L14 14" /></svg>;
const ChartIcon = () => <svg {...s}><path d="M3 13V8.5M8 13V3.5M13 13V6" /></svg>;
const BookIcon = () => <svg {...s}><path d="M3 2.8h7a2 2 0 012 2v8.4H5a2 2 0 01-2-2V2.8z" /><path d="M6 6h5M6 8.6h5" /></svg>;
const PersonIcon = () => <svg {...s}><circle cx="8" cy="5.5" r="2.4" /><path d="M2.8 13.2c.5-2.5 2.6-3.8 5.2-3.8s4.7 1.3 5.2 3.8" /></svg>;
const ShieldIcon = () => <svg {...s}><path d="M8 1.9l5 1.9v4.3c0 3.2-2.1 5.4-5 6.1-2.9-.7-5-2.9-5-6.1V3.8l5-1.9z" /></svg>;
const SignOutIcon = () => (
  <svg {...s}><path d="M6 14H3.5A1.5 1.5 0 012 12.5v-9A1.5 1.5 0 013.5 2H6M10.5 11L14 8l-3.5-3M14 8H6.5" /></svg>
);
