'use client';

import { useEffect, useState } from 'react';

import ClanLink, { useClanPrefixValue } from '@/components/ClanLink';
import { usePageActive } from '@/hooks/usePageActive';
import { clanFetch } from '@/lib/clanFetch';
import type { ClanHallView, HallPerson } from '@/lib/clanHallMerge';

type View = ClanHallView & { viewerTeamId: number | null };

/** How often the card re-reads, while somebody is looking. The server caches Discord for 60s anyway. */
const REFRESH_MS = 60_000;
const ROSTER_ROWS = 8;

const STATUS_COLOR = { online: 'var(--color-accent-green-light)', idle: '#e9b23a', dnd: 'var(--color-accent-red)' } as const;
const IN_GAME = 'var(--color-gold-light)';
const VOICE = '#7f8cff';

function shortXp(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function hue(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function Face({ p, size, ring }: { p: HallPerson; size: number; ring?: string }) {
  const label = (p.rsn || p.name).replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || '?';
  return (
    <span className="relative inline-grid shrink-0" style={{ width: size, height: size }}>
      {p.avatarUrl ? (
        // Discord's CDN; a plain <img> because next/image is not configured for it and these are tiny.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.avatarUrl} alt="" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size, boxShadow: ring }} />
      ) : (
        <span
          className="grid place-items-center rounded-full font-semibold text-brown-dark"
          style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: p.name ? `hsl(${hue(p.name)} 34% 58%)` : 'var(--color-card-border)', boxShadow: ring }}
        >
          {p.name ? label : ''}
        </span>
      )}
    </span>
  );
}

function Pill({ p }: { p: HallPerson }) {
  if (p.voiceChannel) {
    return (
      <span className="whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10.5px]" style={{ color: '#dfe2ff', borderColor: 'rgba(127,140,255,.45)', background: 'rgba(127,140,255,.16)' }}>
        IN VOICE
      </span>
    );
  }
  if (p.inGame) return <span className="whitespace-nowrap rounded-full bg-gold-light px-2 py-0.5 font-mono text-[10.5px] text-brown-dark">IN GAME</span>;
  return (
    <span className="whitespace-nowrap rounded-full border border-card-border px-2 py-0.5 font-mono text-[10.5px] text-text-dim">
      {p.status === 'idle' ? 'IDLE' : p.status === 'dnd' ? 'BUSY' : 'ONLINE'}
    </span>
  );
}

function Doing({ p }: { p: HallPerson }) {
  const d = p.doing;
  if (!d) return <span className="text-text-dim">{p.status ? 'On Discord' : 'Playing'}</span>;
  if (d.kind === 'team') {
    return (
      <span>
        <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: d.color }} />
        <b className="font-medium text-foreground">{d.team}</b>
      </span>
    );
  }
  if (d.kind === 'xp') return <span><b className="font-medium text-foreground">+{shortXp(d.xp)}</b> XP this week</span>;
  return <span className="text-text-dim">Not on the roster</span>;
}

function Bar({ parts }: { parts: { n: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.n, 0);
  return (
    <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-card-bg-hover">
      {total > 0 &&
        parts.map((p, i) => (p.n > 0 ? <i key={i} className="block h-full" style={{ flex: p.n, background: p.color }} /> : null))}
    </div>
  );
}

/**
 * Who's around right now (lib/clanHallMerge): Discord presence, who is in game, who is in voice, and
 * for members, a roster that says what each person is doing on Anvil.
 *
 * Re-reads every minute only while somebody is looking (hooks/usePageActive) — a tab left open does
 * not keep asking.
 */
export default function ClanHall({ initial, src }: { initial: View; /** Which surface, for join counting. */ src: 'home' | 'public' }) {
  const prefix = useClanPrefixValue();
  const [view, setView] = useState<View>(initial);
  const [filter, setFilter] = useState<'all' | 'game' | 'team'>('all');
  const [updatedAt, setUpdatedAt] = useState(() => Date.now());
  const active = usePageActive();

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await clanFetch('/api/discord/hall', { cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data?.view) {
          setView(data.view);
          setUpdatedAt(Date.now());
        }
      } catch {
        // Keep showing the last good read.
      }
    };
    // Coming back after a while: refresh at once, then on the steady tick.
    if (Date.now() - updatedAt > REFRESH_MS) void tick();
    const id = setInterval(tick, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, updatedAt]);

  const { counts } = view;
  const max = Math.max(counts.discord, 1);
  const people = view.people;
  const shown = people
    ? people.filter((p) => filter === 'all' || (filter === 'game' && p.inGame) || (filter === 'team' && view.viewerTeamId != null && p.teamId === view.viewerTeamId))
    : [];
  // "Everyone" counts past Discord's 100-person list: the widget's own total, plus those only in game.
  const total = people && filter === 'all' ? counts.discord + people.filter((p) => !p.status).length : shown.length;
  const hiddenCount = Math.max(0, total - ROSTER_ROWS);

  const funnel = (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
        <div className="display text-right text-[32px] font-semibold leading-none tabular-nums">{counts.discord}</div>
        <div className="min-w-0">
          <div className="mb-1.5 text-[12.5px] text-text-muted"><b className="font-semibold text-foreground">on Discord</b></div>
          <Bar parts={[{ n: counts.online, color: STATUS_COLOR.online }, { n: counts.idle, color: STATUS_COLOR.idle }, { n: counts.dnd, color: STATUS_COLOR.dnd }]} />
          <div className="mt-1.5 flex flex-wrap gap-3 text-[11.5px] tabular-nums text-text-dim">
            <span><i className="mr-1 inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_COLOR.online }} />{counts.online} online</span>
            <span><i className="mr-1 inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_COLOR.idle }} />{counts.idle} idle</span>
            <span><i className="mr-1 inline-block h-[7px] w-[7px] rounded-full" style={{ background: STATUS_COLOR.dnd }} />{counts.dnd} busy</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
        <div className="display text-right text-[32px] font-semibold leading-none tabular-nums" style={{ color: IN_GAME }}>{counts.inGame}</div>
        <div className="min-w-0">
          <div className="mb-1.5 text-[12.5px] text-text-muted"><b className="font-semibold text-foreground">in game</b></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-card-bg-hover"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (counts.inGame / max) * 100)}%`, background: IN_GAME }} /></div>
        </div>
      </div>
      <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3.5">
        <div className="display text-right text-[32px] font-semibold leading-none tabular-nums" style={{ color: VOICE }}>{counts.voice}</div>
        <div className="min-w-0">
          <div className="mb-1.5 text-[12.5px] text-text-muted"><b className="font-semibold text-foreground">in voice</b> · {view.voiceChannels} channel{view.voiceChannels === 1 ? '' : 's'}</div>
          <div className="h-2.5 overflow-hidden rounded-full bg-card-bg-hover"><i className="block h-full rounded-full" style={{ width: `${Math.min(100, (counts.voice / max) * 100)}%`, background: VOICE }} /></div>
        </div>
      </div>
    </div>
  );

  const rooms = (view.rooms.length > 0 || view.emptyRooms.length > 0) && (
    <div className="mt-5 flex flex-col gap-2">
      {view.rooms.map((r) => (
        <div key={r.name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-card-border-soft bg-card-bg-hover px-3 py-2.5">
          <SpeakerIcon color={VOICE} />
          <span className="min-w-0 truncate text-[13px] font-semibold">
            {r.name}
            {r.teamNote && <span className="block truncate text-[11.5px] font-normal text-text-muted">{r.teamNote}</span>}
          </span>
          <span className="flex">
            {r.people.slice(0, 5).map((p, i) => (
              <span key={i} className="-ml-1.5 first:ml-0">
                <Face p={p} size={24} ring="0 0 0 2px var(--color-card-bg-hover)" />
              </span>
            ))}
            {r.people.length > 5 && <span className="ml-1 self-center text-[11px] text-text-muted">+{r.people.length - 5}</span>}
          </span>
        </div>
      ))}
      {view.emptyRooms.length > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-card-border-soft px-3 py-2.5 text-[12.5px] text-text-dim">
          <SpeakerIcon color="var(--color-text-dim)" />
          <span className="min-w-0 truncate">
            {view.rooms.length === 0 ? 'Nobody in voice · ' : ''}
            {view.emptyRooms.slice(0, 3).join(', ')}
            {view.emptyRooms.length > 3 ? ` +${view.emptyRooms.length - 3}` : ''}
            {view.rooms.length > 0 ? ' · empty' : ''}
          </span>
        </div>
      )}
    </div>
  );

  const join = view.guild?.inviteUrl && (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <a
        // Through our redirect, so the click is counted (api/discord/join), then on to the invite.
        href={`${prefix}/api/discord/join?src=${src}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg bg-gold px-4 py-2 text-[13px] font-semibold text-brown-dark transition-colors hover:bg-gold-light"
      >
        Join the Discord
      </a>
    </div>
  );

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border border-card-border bg-card-bg" aria-label="Who's around">
      <div className={people ? 'grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]' : ''}>
        <div className="min-w-0 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <span className="h-5 w-1 rounded-full bg-gold" />
              Right now
            </h2>
            <span className="truncate font-mono text-[10.5px] uppercase tracking-wider text-text-dim">{view.guild?.name}</span>
          </div>
          {funnel}
          {rooms}
          {join}
        </div>

        {people && (
          <div className="min-w-0 border-t border-card-border-soft p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="display text-[17px] font-semibold">Around</h2>
              <div className="inline-flex gap-0.5 rounded-lg border border-card-border p-0.5" role="group" aria-label="Filter who's around">
                {(
                  [
                    ['all', 'Everyone'],
                    ['game', 'In game'],
                    ...(view.viewerTeamId != null ? [['team', 'My team']] : []),
                  ] as [typeof filter, string][]
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={filter === k}
                    onClick={() => setFilter(k)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${filter === k ? 'bg-card-bg-hover text-foreground' : 'text-text-muted hover:text-foreground'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {shown.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-text-dim">
                {filter === 'game' ? 'Nobody in game right now.' : filter === 'team' ? 'Nobody from your team is around.' : 'Nobody around right now.'}
              </p>
            ) : (
              <ul className="flex flex-col">
                {shown.slice(0, ROSTER_ROWS).map((p, i) => (
                  <li
                    key={`${p.name}-${i}`}
                    className={`grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-3 border-b border-card-border-soft py-2 last:border-b-0 ${p.rsn ? '' : 'opacity-60'}`}
                  >
                    <span className="relative">
                      <Face p={p} size={34} ring={p.inGame ? '0 0 0 2px var(--color-card-bg), 0 0 0 3.5px var(--color-gold)' : undefined} />
                      {p.status && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full border-2 border-card-bg" style={{ background: STATUS_COLOR[p.status] }} />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        {p.rsn ? (
                          <ClanLink href={`/members/${encodeURIComponent(p.rsn)}`} className="truncate text-[13.5px] font-semibold hover:text-gold">
                            {p.rsn}
                          </ClanLink>
                        ) : (
                          <span className="truncate text-[13.5px] font-semibold">{p.name}</span>
                        )}
                        {p.rank && <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-gold-dark">{p.rank}</span>}
                      </span>
                      <span className="block truncate text-xs text-text-muted"><Doing p={p} /></span>
                    </span>
                    <Pill p={p} />
                  </li>
                ))}
              </ul>
            )}
            {hiddenCount > 0 && (
              <p className="mt-2.5 text-[12.5px] text-text-muted">
                + {hiddenCount} more {filter === 'game' ? 'in game' : filter === 'team' ? 'on your team' : 'around'}
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-3 border-t border-card-border-soft px-5 py-2.5 font-mono text-[10.5px] text-text-dim sm:px-6">
        <span>Live from Discord and the Anvil plugin{active ? '' : ' · paused while you’re away'}</span>
        {view.truncated && <span>Discord lists the first 100 people</span>}
      </div>
    </section>
  );
}

function SpeakerIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden style={{ fill: color }} className="shrink-0">
      <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7l-1.1-1.1a3.5 3.5 0 0 0 0-4.8l1.1-1.1Z" />
    </svg>
  );
}
