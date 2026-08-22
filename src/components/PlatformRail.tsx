'use client';

import ClanLink from '@/components/ClanLink';
import { usePathname } from 'next/navigation';

export interface RailClan {
  slug: string;
  name: string;
  /** Something is running there right now — the one thing worth a dot in a nav. */
  live?: boolean;
}

/**
 * The platform's own navigation, on the apex only.
 *
 * There used to be one nav and it was a clan's — so the apex offered Events and Members, which 404
 * there because the apex has no roster. This is the other half of that split: the rail is what the
 * PLATFORM has, and a clan's pages keep the top nav they always had.
 *
 * The second group is the part a directory site would not have. A person is in several clans and
 * moves between them constantly, so their clans live in the furniture rather than on a page you have
 * to go find. It is also the only place the platform admits, visually, that you belong to more than
 * one thing.
 *
 * Every destination here is a platform path, so ClanLink passes them through untouched — which is
 * exactly why the rule forbidding bare next/link has no exception for "I know this one is safe".
 * It caught this file when it was written with Link.
 */
export default function PlatformRail({
  clans,
  signedIn,
  displayName,
}: {
  clans: RailClan[];
  signedIn: boolean;
  displayName: string | null;
}) {
  const pathname = usePathname() ?? '/';

  const item = (href: string, label: string, icon: React.ReactNode, badge?: string) => {
    // Exact match for the root, prefix match for the rest, so /clans/new keeps Clans lit.
    const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
    return (
      <ClanLink
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
          active
            ? 'bg-gold/10 text-gold'
            : 'text-text-muted hover:bg-brown-light hover:text-foreground'
        }`}
      >
        <span className={active ? 'text-gold' : 'text-text-muted/70'}>{icon}</span>
        {label}
        {badge && (
          <span className="ml-auto rounded border border-card-border bg-card-bg px-1.5 font-mono text-[10px] text-text-muted">
            {badge}
          </span>
        )}
      </ClanLink>
    );
  };

  return (
    <nav className="flex shrink-0 flex-col gap-6 border-b border-card-border bg-brown-dark p-3 md:h-full md:w-[226px] md:border-b-0 md:border-r">
      <ClanLink href="/" className="flex items-center gap-2.5 px-2.5 pt-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-48.png" alt="" width={26} height={26} className="rounded-md" />
        <span className="font-bold text-lg text-gold">Anvil</span>
      </ClanLink>

      <div className="flex flex-col gap-px">
        <div className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          Platform
        </div>
        {item('/', 'Home', <HomeIcon />)}
        {item('/clans', 'Find a clan', <ClansIcon />)}
        {item('/leaderboard', 'Records', <ChartIcon />)}
        {item('/guide', 'Guides', <BookIcon />)}
      </div>

      {clans.length > 0 && (
        <div className="flex flex-col gap-px">
          <div className="px-2.5 pb-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Your clans
          </div>
          {clans.map((c) => (
            <ClanLink
              key={c.slug}
              href={`/c/${c.slug}`}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-text-muted transition-colors hover:bg-brown-light hover:text-foreground"
            >
              <Crest name={c.name} />
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
      )}

      <div className="mt-auto flex flex-col gap-px">
        {signedIn
          ? item('/profile', displayName ?? 'You', <PersonIcon />)
          : item('/login', 'Sign in', <PersonIcon />)}
      </div>
    </nav>
  );
}

/** Two letters on a coloured chip. Derived from the name so it is stable without storing anything. */
function Crest({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  // A hue per clan, from the name. Deterministic, so a clan keeps its colour between requests.
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return (
    <span
      className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded font-mono text-[9px] font-semibold text-brown-dark"
      style={{ background: `hsl(${h} 34% 42%)` }}
    >
      {initials}
    </span>
  );
}

const s = { width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 } as const;
const HomeIcon = () => <svg {...s}><path d="M2 7l6-4.5L14 7v6.5a1 1 0 01-1 1H3a1 1 0 01-1-1V7z" /></svg>;
const ClansIcon = () => (
  <svg {...s}><circle cx="5.5" cy="6" r="2.2" /><circle cx="11" cy="6.6" r="1.8" />
    <path d="M1.6 13c.4-2 1.9-3.1 3.9-3.1S9 11 9.4 13M10 10c1.8-.3 3.6.7 4 3" /></svg>
);
const ChartIcon = () => <svg {...s}><path d="M3 13V8.5M8 13V3.5M13 13V6" /></svg>;
const BookIcon = () => <svg {...s}><path d="M3 2.8h7a2 2 0 012 2v8.4H5a2 2 0 01-2-2V2.8z" /><path d="M6 6h5M6 8.6h5" /></svg>;
const PersonIcon = () => <svg {...s}><circle cx="8" cy="5.5" r="2.4" /><path d="M2.8 13.2c.5-2.5 2.6-3.8 5.2-3.8s4.7 1.3 5.2 3.8" /></svg>;
