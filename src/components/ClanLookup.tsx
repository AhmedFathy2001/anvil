'use client';

import { useMemo, useState, type ReactNode } from 'react';

import AnvilMark from '@/components/AnvilMark';
import ClanCrest from '@/components/ClanCrest';
import ClanLink from '@/components/ClanLink';
import MotionImg from '@/components/MotionImg';
import type { ClanFocus } from '@/lib/clanHome';

export interface LookupClan {
  slug: string;
  name: string;
  members: number;
  /** The clan's own image, or null for the generated crest. */
  logoUrl?: string | null;
  /** The clan's wide banner, or null for a strip tinted from its crest. */
  bannerUrl?: string | null;
  bannerPosition?: number | null;
  /** The one-line hook from the clan's public profile. */
  tagline?: string | null;
  focus?: ClanFocus[];
  recruiting?: boolean;
  openToChallenges?: boolean;
  events?: number;
  /** What is running there now, if anything — the one thing worth reading first. */
  doing: string | null;
  /** The viewer's own standing here, so their clans do not offer them a way to apply. */
  seat: 'member' | 'guest' | null;
  /** In-game name proven, so this is the clan it says it is. */
  verified: boolean;
  /** 'approval' | 'open' | 'closed'. */
  guestPolicy: string;
  /** Members who gained anything in seven days. */
  activeThisWeek: number;
  xpThisWeek: number;
}

type Sort = 'active' | 'size' | 'name';

/**
 * Whether a stranger can get in, or wants a fight. The first questions anybody browsing has.
 */
type Filter = 'any' | 'open' | 'challenge';

const FOCUS_LABEL: Record<ClanFocus, string> = {
  pvm: 'PvM',
  skilling: 'Skilling',
  pvp: 'PvP',
  social: 'Social',
  ironman: 'Ironman',
};

/**
 * Somewhere to play, or somebody to play against.
 *
 * THE QUESTION THIS PAGE ANSWERS is "would I join this clan", and a table of names and member counts
 * answers none of it. Each clan is drawn the way a Discord server invite is — its banner, its icon,
 * its one-line pitch — because that is the card people already know how to read, and it puts the
 * clan's own identity first and the numbers second.
 *
 * EVERY CLAN IN ONE LIST, the viewer's own included. They used to be split out into a row of chips
 * above, which with three clans on the platform left the actual list nearly empty. A clan you are in
 * is marked on its card instead, and simply offers no way to apply.
 *
 * Sorted by ACTIVITY by default, not alphabetically. A directory ordered by name tells you who is
 * called what; ordered by who is playing, the first card is somewhere worth clicking.
 */
export default function ClanLookup({ clans }: { clans: LookupClan[] }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('active');
  const [filter, setFilter] = useState<Filter>('any');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = clans;
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.includes(q) ||
          (c.tagline ?? '').toLowerCase().includes(q),
      );
    }
    if (filter === 'open') filtered = filtered.filter((c) => c.guestPolicy !== 'closed' || c.recruiting);
    if (filter === 'challenge') filtered = filtered.filter((c) => c.openToChallenges);
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'size') return b.members - a.members || a.name.localeCompare(b.name);
      // Activity, and the share that played breaks the tie — so a small clan that all turned up
      // outranks a large one where the same number did.
      return (
        b.activeThisWeek - a.activeThisWeek ||
        share(b) - share(a) ||
        a.name.localeCompare(b.name)
      );
    });
  }, [clans, query, sort, filter]);

  // The platform at a glance — the same four-cell strip the Hall of Records opens its clans with.
  const totals = useMemo(
    () => ({
      clans: clans.length,
      members: clans.reduce((n, c) => n + c.members, 0),
      played: clans.reduce((n, c) => n + c.activeThisWeek, 0),
      live: clans.filter((c) => c.doing).length,
    }),
    [clans],
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="relative mb-6 overflow-hidden">
        <AnvilMark
          size={190}
          className="pointer-events-none absolute -top-10 right-0 hidden text-gold/[0.04] sm:block"
        />
        <h1 className="display display-lg relative text-[clamp(1.7rem,4vw,2.2rem)] font-semibold">
          Clan Hall
        </h1>
        <p className="relative mt-2 max-w-[62ch] text-[14.5px] text-text-muted">
          For when you want somewhere to play, or somebody to play against. Joining one never affects
          the others — your account and characters follow you between them.
        </p>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-card-border bg-card-border lg:grid-cols-4">
        <Stat label="Clans listed" value={totals.clans.toLocaleString()} />
        <Stat label="Members" value={totals.members.toLocaleString()} />
        <Stat label="Played this week" value={totals.played.toLocaleString()} />
        <Stat
          label="Running now"
          value={totals.live.toLocaleString()}
          dot={totals.live > 0}
          note={totals.live === 1 ? 'clan with a live event' : 'clans with a live event'}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search clans…"
          className="min-w-0 flex-1 rounded-lg border border-card-border bg-card-bg px-3.5 py-2 text-[14px] outline-none transition-colors placeholder:text-text-dim focus:border-gold/45"
        />
        <Chips
          value={filter}
          onChange={setFilter}
          options={[
            ['any', 'All clans'],
            ['open', 'Taking members'],
            ['challenge', 'Open to challenges'],
          ]}
        />
        <Chips
          value={sort}
          onChange={setSort}
          options={[
            ['active', 'Most active'],
            ['size', 'Biggest'],
            ['name', 'A–Z'],
          ]}
        />
      </div>

      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-5 w-1 rounded-sm bg-gold" />
        <h2 className="text-[16.5px] font-semibold">
          {filter === 'open' ? 'Taking members' : filter === 'challenge' ? 'Open to challenges' : 'Every clan'}
        </h2>
        <span className="font-mono text-[11px] text-text-dim">{shown.length}</span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-card-border px-5 py-10 text-center text-sm text-text-muted">
          {query ? `Nothing matching “${query}”.` : clans.length > 0 ? 'No clan fits that filter yet.' : 'No clans are listed yet.'}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => (
            <Card key={c.slug} clan={c} />
          ))}
          <StartYourOwn />
        </div>
      )}

      <p className="mt-6 text-xs text-text-dim">
        Every clan here chose to be listed. A clan that keeps to itself is still reachable by link if
        it allows that — being unlisted is not the same as being private.
      </p>
    </div>
  );
}

function Stat({ label, value, note, dot }: { label: string; value: string; note?: string; dot?: boolean }) {
  return (
    <div className="bg-card-bg px-4 py-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-dim">{label}</p>
      <p className="mt-1 flex items-center gap-2 text-[20px] font-semibold tabular-nums">
        {dot && <span className="h-2 w-2 rounded-full bg-accent-green-light shadow-[0_0_8px] shadow-accent-green-light/60" />}
        {value}
      </p>
      {note && <p className="font-mono text-[10px] text-text-dim">{note}</p>}
    </div>
  );
}

function Chips<K extends string>({
  value,
  onChange,
  options,
}: {
  value: K;
  onChange: (k: K) => void;
  options: readonly (readonly [K, string])[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          aria-pressed={value === key}
          className={`rounded-md border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors ${
            value === key
              ? 'border-gold/30 bg-gold/[0.07] text-gold'
              : 'border-transparent text-text-muted hover:bg-brown-light hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * One clan, as a server invite card: banner, icon over its lower edge, name and pitch, then the
 * pulse. A clan with no banner gets a strip tinted from its crest's hue, so the grid never shows an
 * empty grey box and two banner-less clans still look like two different places.
 */
function Card({ clan }: { clan: LookupClan }) {
  const hue = nameHue(clan.name);
  const played = clan.members > 0 ? Math.round((clan.activeThisWeek / clan.members) * 100) : 0;
  const focus = clan.focus ?? [];

  return (
    <ClanLink
      href={`/c/${clan.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-card-border bg-card-bg shadow-[0_1px_0_rgba(255,255,255,0.02)_inset] transition-all hover:-translate-y-0.5 hover:border-gold/40 hover:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.7)]"
    >
      <div className="relative h-24 shrink-0 overflow-hidden">
        {clan.bannerUrl ? (
          <MotionImg
            src={clan.bannerUrl}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            style={{ objectPosition: `50% ${clan.bannerPosition ?? 50}%` }}
          />
        ) : (
          <div
            aria-hidden
            className="h-full w-full"
            style={{
              background: `radial-gradient(120% 140% at 85% 0%, hsl(${(hue + 30) % 360} 45% 30% / 0.9), transparent 60%), linear-gradient(135deg, hsl(${hue} 38% 22%), hsl(${hue} 30% 12%))`,
            }}
          >
            <AnvilMark size={120} className="absolute -bottom-6 right-3 text-white/[0.06]" />
          </div>
        )}
        {/* Fade into the card so the icon's ring reads against either a photo or a gradient. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card-bg/80 to-transparent" />

        {clan.seat && (
          <span className="absolute left-3 top-3 rounded-md border border-gold/40 bg-brown-dark/80 px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-gold backdrop-blur-sm">
            {clan.seat === 'member' ? 'Your clan' : 'You’re a guest'}
          </span>
        )}
        {clan.doing && (
          <span className="absolute right-3 top-3 flex max-w-[60%] items-center gap-1.5 rounded-md bg-brown-dark/80 px-2 py-0.5 text-[11.5px] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent-green-light" />
            <span className="truncate">{clan.doing}</span>
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4">
        <div className="-mt-8 flex items-end gap-2">
          <span className="relative rounded-2xl bg-card-bg p-1">
            <ClanCrest name={clan.name} logoUrl={clan.logoUrl} size={56} rounded="rounded-xl" className="text-lg" />
          </span>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <span className="truncate text-[16px] font-semibold">{clan.name}</span>
          {clan.verified && (
            // The badge means the in-game name is proven — the thing that stops somebody
            // registering a famous clan's name and collecting its members.
            <span
              title="In-game name verified"
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-accent-green/80 text-[10px] font-bold text-brown-dark"
            >
              ✓
            </span>
          )}
        </div>

        <p className="mt-1 line-clamp-2 min-h-[2.5em] text-[13px] leading-snug text-text-muted">
          {clan.tagline ??
            (clan.events
              ? `${clan.events} event${clan.events === 1 ? '' : 's'} run on Anvil.`
              : 'New on Anvil.')}
        </p>

        {focus.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {focus.map((f) => (
              <span
                key={f}
                className="rounded border border-card-border bg-brown-light/60 px-1.5 py-px text-[11px] text-text-muted"
              >
                {FOCUS_LABEL[f]}
              </span>
            ))}
          </div>
        )}

        {/* THE PULSE, in the shape Discord prints "1,234 Online · 9,876 Members" — which everybody
            already reads without thinking. "Online" here is "played this week". */}
        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent-green-light" />
              <b className="font-semibold tabular-nums">{clan.activeThisWeek.toLocaleString()}</b>
              <span className="text-text-dim">played this week</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-text-dim/60" />
              <b className="font-semibold tabular-nums">{clan.members.toLocaleString()}</b>
              <span className="text-text-dim">member{clan.members === 1 ? '' : 's'}</span>
            </span>
          </div>
          {clan.members > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <span className="block h-1 flex-1 overflow-hidden rounded-sm bg-brown-light">
                <span
                  className="block h-full rounded-sm bg-gradient-to-r from-gold-dark to-gold"
                  style={{ width: `${Math.min(100, played)}%` }}
                />
              </span>
              <span className="font-mono text-[10.5px] tabular-nums text-text-dim">
                {played}%{clan.xpThisWeek > 0 && <> · {compact(clan.xpThisWeek)} xp</>}
              </span>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-card-border pt-3">
            {/* CAN I EVEN GET IN. Only worth saying to somebody who is not already here. */}
            {!clan.seat && (
              <Tag tone={clan.recruiting || clan.guestPolicy === 'open' ? 'green' : clan.guestPolicy === 'closed' ? 'dim' : 'gold'}>
                {clan.recruiting ? 'Recruiting' : doorway(clan.guestPolicy)}
              </Tag>
            )}
            {clan.openToChallenges && <Tag tone="red">Open to challenges</Tag>}
            <span className="ml-auto text-[12px] text-text-dim transition-colors group-hover:text-gold">
              {clan.seat ? 'Open →' : 'View clan →'}
            </span>
          </div>
        </div>
      </div>
    </ClanLink>
  );
}

/** The grid's last card — the moment somebody who did not find their clan should make one. */
function StartYourOwn() {
  return (
    <ClanLink
      href="/clans/new"
      className="group flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-card-border p-6 text-center transition-colors hover:border-gold/40 hover:bg-card-bg"
    >
      <span className="grid h-12 w-12 place-items-center rounded-xl border border-gold/30 bg-gold/[0.07] text-2xl text-gold">
        +
      </span>
      <span className="text-[15px] font-semibold">Your clan here</span>
      <span className="max-w-[28ch] text-[12.5px] text-text-dim">
        Start your own — it is free, and live as soon as you submit.
      </span>
    </ClanLink>
  );
}

function Tag({ tone, children }: { tone: 'green' | 'gold' | 'dim' | 'red'; children: ReactNode }) {
  const cls = {
    green: 'bg-accent-green/10 text-accent-green-light',
    gold: 'bg-gold/[0.08] text-gold-dark',
    dim: 'bg-brown-light text-text-dim',
    red: 'bg-red-500/10 text-red-300',
  }[tone];
  return (
    <span className={`rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] ${cls}`}>
      {children}
    </span>
  );
}

/** What the guest policy means to somebody standing outside. */
function doorway(policy: string): string {
  if (policy === 'open') return 'Open';
  if (policy === 'closed') return 'Closed';
  return 'By approval';
}

/** The same hue ClanCrest's initials variant derives, so the banner strip matches the icon. */
function nameHue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const share = (c: LookupClan) => (c.members > 0 ? c.activeThisWeek / c.members : 0);

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
