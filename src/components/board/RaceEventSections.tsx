'use client';

import type { ReactNode } from 'react';
import ClanLink from '@/components/ClanLink';
import { cn } from '@/lib/utils';
import { roadChoiceLine, type RaceGraph, type TeamRoute } from '@/lib/raceRoutes';
import { hoursText, type RaceFeedItem, type RaceStatCards, type RaceTeamLine } from '@/lib/raceSummary';
import type { TeamMvp } from '@/lib/memberBreakdown';

/**
 * The tile race's own sections on the event page (lib/raceSummary): the four stat cards over the
 * race track, the race standings, "Up next for <team>", the gap watch and the race feed. Real data
 * only; every one of them reads the same route the board draws.
 */

const MEDALS = ['🥇', '🥈', '🥉'];

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
        <span className="w-1 h-5 bg-gold rounded-full" />
        {children}
      </h2>
      {aside}
    </div>
  );
}

export { SectionTitle as RaceSectionTitle };

function StatCard({ label, children, sub, accent }: { label: string; children: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="rounded-xl border border-card-border bg-card-bg p-3 min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-text-muted font-semibold">{label}</p>
      <p className="mt-1 text-base font-bold truncate" style={accent ? { color: accent } : undefined}>{children}</p>
      {sub && <p className="text-xs text-text-muted truncate">{sub}</p>}
    </div>
  );
}

/** Leader · Your team · Busiest road · Race pace. Cards with nothing to say yet are left out. */
export function RaceStatCardsRow({ cards }: { cards: RaceStatCards }) {
  const items: ReactNode[] = [];
  if (cards.leader) items.push(<StatCard key="l" label="Leader" accent={cards.leader.color} sub={cards.leader.line}>{cards.leader.name}</StatCard>);
  if (cards.you) items.push(<StatCard key="y" label="Your team" sub={cards.you.sub}>{cards.you.line}</StatCard>);
  if (cards.busiest) items.push(<StatCard key="b" label="Busiest road" sub={cards.busiest.sub}>{cards.busiest.line}</StatCard>);
  if (cards.pace) items.push(<StatCard key="p" label="Race pace" sub={cards.pace.sub}>{cards.pace.line}</StatCard>);
  if (!items.length) return null;
  return <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">{items}</div>;
}

/**
 * The standings as race cards: medal, colour, name, steps big and gold, how far behind, a bar,
 * the road taken and the tile the team stands on, its MVP and pace. A crowd gets compact rows.
 */
export function RaceStandings({
  lines,
  steps,
  labelOf,
  teamMvps = {},
  eventId,
  viewerTeamId,
  compact = false,
}: {
  lines: RaceTeamLine[];
  steps: number;
  labelOf: (id: number) => string;
  teamMvps?: Record<number, TeamMvp | null>;
  eventId: number;
  viewerTeamId: number | null;
  compact?: boolean;
}) {
  if (!lines.length) return <p className="text-sm text-text-muted">No teams yet.</p>;
  if (compact) {
    return (
      <ul className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border overflow-hidden">
        {lines.map((l) => (
          <li key={l.team.id} className={cn('flex items-center gap-3 px-3 py-2 text-sm', l.team.id === viewerTeamId && 'bg-gold/10')}>
            <span className="w-6 text-right text-xs text-text-muted tabular-nums">{l.rank}</span>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.team.color }} />
            <ClanLink href={`/events/${eventId}/teams/${l.team.id}`} className="truncate flex-1 hover:text-gold">{l.team.name}</ClanLink>
            <span className="text-xs text-text-muted hidden sm:inline">{l.road ? `road ${l.road}` : 'at the start'}</span>
            <span className="tabular-nums font-semibold text-gold">{l.finished ? '🏁' : `${l.stepsDone}/${steps}`}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="space-y-2.5">
      {lines.map((l, i) => {
        const mvp = teamMvps[l.team.id] ?? null;
        const pct = steps ? Math.round((l.stepsDone / steps) * 100) : 0;
        const leading = i === 0 && l.stepsDone > 0;
        return (
          <ClanLink
            key={l.team.id}
            href={`/events/${eventId}/teams/${l.team.id}`}
            className={cn('block border rounded-xl p-4 transition-all duration-200 hover:scale-[1.01]', l.team.id === viewerTeamId && 'ring-1 ring-gold/50')}
            style={{ borderColor: leading ? `${l.team.color}60` : 'var(--card-border)', backgroundColor: leading ? `${l.team.color}08` : 'var(--card-bg)' }}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg w-7 text-center shrink-0">{l.rank <= 3 && l.stepsDone > 0 ? MEDALS[l.rank - 1] : <span className="text-text-muted text-sm font-mono">#{l.rank}</span>}</span>
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: l.team.color }} />
                <span className="font-bold text-lg truncate">{l.team.name}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-bold text-gold tabular-nums">{l.finished ? '🏁' : l.stepsDone}</span>
                <span className="text-text-muted text-sm">/{steps}</span>
                <p className="text-xs text-text-muted">{l.finished ? 'finished' : l.behind === 0 ? (lines.length > 1 ? 'leading' : '') : `${l.behind} behind`}</p>
              </div>
            </div>
            <div className="w-full bg-brown-dark rounded-full h-2.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${l.team.color}cc, ${l.team.color})` }} />
            </div>
            <p className="mt-2 text-xs text-text-muted truncate">
              {l.currentTileId != null ? <>Road {l.road} · on <span className="text-foreground/90">{labelOf(l.currentTileId)}</span></> : 'At the start line'}
              {l.perStep ? <> · 1 tile / {hoursText(l.perStep)}</> : null}
            </p>
            {mvp && (
              <p className="flex items-center gap-1.5 mt-2 pt-2 border-t border-card-border/60 text-[11px] text-text-muted">
                <span aria-hidden>🏆</span>
                <span className="text-gold/90 font-medium truncate min-w-0">{mvp.name}</span>
                <span className="shrink-0 ml-auto">{mvp.tasks} tile{mvp.tasks === 1 ? '' : 's'}</span>
              </p>
            )}
          </ClanLink>
        );
      })}
    </div>
  );
}

/**
 * "Up next for <team>": a card per open tile — its sprite, what it does to the road, the team's live
 * progress on it, and who else is racing for it. By achievement it never says "choose": whichever
 * the team gets first sets the road. On a choose-and-lock race at a fork it's the pick.
 */
export function RaceUpNext({
  graph,
  route,
  teamName,
  tileById,
  progressFor,
  racersFor,
  onTileClick,
  canPick,
  picking,
  onPick,
  pickError,
}: {
  graph: RaceGraph;
  route: TeamRoute;
  teamName: string;
  tileById: Map<number, { id: number; label: string; icon?: string | null }>;
  progressFor: (tileId: number) => { current: number; goal: number } | null;
  racersFor: (tileId: number) => { name: string; color: string }[];
  onTileClick?: (id: number) => void;
  canPick: boolean;
  picking: boolean;
  onPick: (id: number) => void;
  pickError: string | null;
}) {
  if (route.finished) {
    return <p className="rounded-xl border border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold font-semibold">🏁 {teamName} reached the finish.</p>;
  }
  const choosing = route.pickFrom.length > 0;
  const ids = choosing ? route.pickFrom : route.open;
  return (
    <section aria-label={`Up next for ${teamName}`}>
      <SectionTitle>{choosing ? `Pick your road, ${teamName}` : `Up next for ${teamName}`}</SectionTitle>
      <p className="text-xs text-text-muted -mt-1.5 mb-3">
        {choosing
          ? canPick
            ? 'A fork: pick the tile your team goes for. Only the picked tile counts, and the pick can’t be changed.'
            : 'A fork: your captain picks the road before any tile here counts.'
          : ids.length > 1
            ? 'Whichever you get first sets your road — the others close for your team.'
            : 'Your next tile.'}
      </p>
      <div className="space-y-2.5">
        {ids.map((id) => {
          const t = tileById.get(id);
          const p = progressFor(id);
          const racers = racersFor(id);
          const pct = p && p.goal > 0 ? Math.min(100, Math.round((p.current / p.goal) * 100)) : null;
          return (
            <div key={id} className="rounded-xl border-2 border-dashed border-gold/70 bg-gold/10 p-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={onTileClick ? () => onTileClick(id) : undefined} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <span className="w-11 h-11 rounded-full bg-[#1c1714] border-2 border-gold flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(224,170,30,0.45)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {t?.icon ? <img src={t.icon} alt="" className="w-7 h-7 object-contain" style={{ imageRendering: 'pixelated' }} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground truncate">{t?.label ?? `Tile ${id}`}</span>
                    <span className="block text-[11px] text-gold">{roadChoiceLine(graph, route, id)}</span>
                  </span>
                </button>
                {choosing && canPick && (
                  <button type="button" disabled={picking} onClick={() => onPick(id)} className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/50 text-gold hover:bg-gold/30 disabled:opacity-50">
                    Pick
                  </button>
                )}
              </div>
              {pct != null && p && (
                <div className="mt-2.5">
                  <div className="flex justify-between text-[11px] text-text-muted mb-1">
                    <span>Your progress</span>
                    <span className="tabular-nums">{p.current.toLocaleString()} / {p.goal.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-brown-dark overflow-hidden"><div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} /></div>
                </div>
              )}
              {racers.length > 0 && (
                <p className="mt-2 text-[11px] text-text-muted flex items-center gap-1.5 flex-wrap">
                  Also racing for it:
                  {racers.slice(0, 4).map((r) => (
                    <span key={r.name} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />{r.name}</span>
                  ))}
                  {racers.length > 4 && <span>+{racers.length - 4}</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {pickError && <p className="text-xs text-red-400 mt-2">{pickError}</p>}
    </section>
  );
}

/** Plain sentences on who could catch whom. */
export function RaceGapWatch({ sentences }: { sentences: string[] }) {
  if (!sentences.length) return null;
  return (
    <section className="rounded-xl border border-card-border bg-card-bg p-4">
      <h3 className="text-sm font-bold flex items-center gap-2 mb-2"><span className="w-1 h-4 bg-gold rounded-full" />Gap watch</h3>
      <ul className="space-y-1.5">
        {sentences.map((s) => <li key={s} className="text-sm text-foreground/90">{s}</li>)}
      </ul>
    </section>
  );
}

function ago(at: string | null, now: number): string {
  if (!at) return '';
  const t = Date.parse(at.includes('T') ? at : `${at.replace(' ', 'T')}Z`);
  return Number.isFinite(t) ? `${hoursText(now - t)} ago` : '';
}

/** The race as it happened, newest first. */
export function RaceFeedList({ items, now, onTileClick }: { items: RaceFeedItem[]; now: number | null; onTileClick?: (id: number) => void }) {
  if (!items.length) return null;
  return (
    <section className="mt-8">
      <SectionTitle aside={<span className="text-[11.5px] text-text-muted">every finish, newest first</span>}>Race feed</SectionTitle>
      <ul className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border overflow-hidden">
        {items.map((it, i) => (
          <li key={`${it.tileId}-${it.team.id}-${i}`}>
            <button type="button" onClick={onTileClick ? () => onTileClick(it.tileId) : undefined} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-card-bg-hover min-w-0">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: it.team.color }} />
              <span className="min-w-0 flex-1 text-sm truncate"><span className="font-semibold">{it.team.name}</span> <span className="text-text-muted">finished</span> {it.line}</span>
              {now != null && <span className="shrink-0 text-[11px] text-text-muted font-mono">{ago(it.at, now)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
