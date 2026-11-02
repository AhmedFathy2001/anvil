'use client';

import { useEffect, useMemo, useState } from 'react';

import ClanLink from '@/components/ClanLink';
import { clanFetch } from '@/lib/clanFetch';
import {
  needChecks,
  needCount,
  tileNeedHref,
  tileNeeds,
  type TileNeed,
  type TileNeeds,
  type TileNeedsLike,
} from '@/lib/tileRequirements';

// "Before you start" on a tile (lib/tileRequirements): what the tile needs from a player, what it
// can't do, and — for the signed-in player on this board — anything of theirs that's in the way
// (lib/tileReadiness). Personal problems sit on top where they can't be missed; the full list folds
// away once it's long. `compact` is the admin editor's version: the same list, no personal checks.

interface Result {
  tileId: number;
  check: string;
  status: 'ok' | 'problem' | 'unknown';
  text: string;
}

type Props = {
  tile: TileNeedsLike & { id?: number; parts?: (TileNeedsLike & { id?: number })[] | null };
  /** The board, for the viewer's own checks. Omit to show the list alone. */
  eventId?: number;
  /** Admin surfaces: "what players will need", folded, no personal checks. */
  compact?: boolean;
  /** Compact only: the fold's label (the editor says it reads the saved settings). */
  label?: string;
};

/** Lists longer than this start folded. */
const OPEN_UP_TO = 4;

export default function TileBeforeYouStart({ tile, eventId, compact = false, label = 'What players will need' }: Props) {
  const needs = useMemo(() => tileNeeds(tile), [tile]);
  const total = needCount(needs);
  const wantsChecks = !compact && eventId != null && tile.id != null && needChecks(needs).length > 0;
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (!wantsChecks) return;
    let cancelled = false;
    clanFetch(`/api/events/${eventId}/tiles/${tile.id}/readiness`)
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((d: { results?: Result[] }) => {
        if (!cancelled) setResults(Array.isArray(d.results) ? d.results : []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wantsChecks, eventId, tile.id]);

  if (total === 0) return null;

  const problems = results.filter((r) => r.status === 'problem');
  const resultsFor = (tileId: number | undefined, n: TileNeed) =>
    tileId == null || !n.check ? [] : results.filter((r) => r.tileId === tileId && r.check === n.check);

  if (compact) {
    return (
      <details className="rounded-lg border border-card-border bg-card-bg/60 px-3 py-2 text-xs">
        <summary className="cursor-pointer text-text-muted hover:text-foreground">
          {label} ({total})
        </summary>
        <NeedLists needs={needs} tileId={tile.id} resultsFor={() => []} compact />
      </details>
    );
  }

  return (
    <div className="space-y-2">
      {problems.length > 0 && (
        <div role="status" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-300 mb-1">Before you start</p>
          <ul className="space-y-1">
            {problems.map((p, i) => (
              <li key={`${p.tileId}-${p.check}-${i}`} className="text-xs text-amber-100/90 leading-relaxed">
                {p.text}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details open={total <= OPEN_UP_TO} className="group rounded-lg border border-card-border bg-brown-dark/40 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-gold/90 hover:text-gold">
          What this tile needs{total > OPEN_UP_TO ? ` (${total})` : ''}
        </summary>
        <NeedLists needs={needs} tileId={tile.id} resultsFor={resultsFor} />
      </details>
    </div>
  );
}

function NeedLists({
  needs,
  tileId,
  resultsFor,
  compact = false,
}: {
  needs: TileNeeds;
  tileId: number | undefined;
  resultsFor: (tileId: number | undefined, n: TileNeed) => Result[];
  compact?: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      <NeedList items={needs.requirements} tileId={tileId} resultsFor={resultsFor} />
      {needs.limitations.length > 0 && (
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted/80 mb-1">{compact ? 'Limits' : 'Good to know'}</p>
          <NeedList items={needs.limitations} tileId={tileId} resultsFor={resultsFor} />
        </div>
      )}
      {(needs.parts ?? []).map((p, i) =>
        p.needs.requirements.length + p.needs.limitations.length === 0 ? null : (
          <div key={p.id ?? i} className="border-t border-card-border/60 pt-2">
            <p className="text-[11px] font-medium text-foreground/85 mb-1">
              Part {i + 1}: {p.label}
            </p>
            <NeedLists needs={p.needs} tileId={p.id} resultsFor={resultsFor} compact={compact} />
          </div>
        ),
      )}
    </div>
  );
}

function NeedList({
  items,
  tileId,
  resultsFor,
}: {
  items: TileNeed[];
  tileId: number | undefined;
  resultsFor: (tileId: number | undefined, n: TileNeed) => Result[];
}) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((n) => {
        const mine = resultsFor(tileId, n);
        const problem = mine.some((r) => r.status === 'problem');
        const ok = mine.length > 0 && mine.every((r) => r.status === 'ok');
        return (
          <li key={n.id} className="flex gap-2 text-xs leading-relaxed">
            <span
              aria-hidden="true"
              className={`mt-[3px] shrink-0 w-3 text-center ${problem ? 'text-amber-300' : ok ? 'text-accent-green-light' : 'text-text-muted/60'}`}
            >
              {problem ? '!' : ok ? '✓' : n.kind === 'requirement' ? '•' : '–'}
            </span>
            <span className="min-w-0">
              <span className={problem ? 'text-amber-100/90' : 'text-text-muted'}>{n.text}</span>{' '}
              <ClanLink href={tileNeedHref(n.anchor)} className="text-gold/80 hover:text-gold hover:underline whitespace-nowrap">
                Why?
              </ClanLink>
              {mine
                .filter((r) => r.status !== 'problem')
                .map((r, i) => (
                  <span key={i} className={`block ${r.status === 'ok' ? 'text-accent-green-light/80' : 'text-text-muted/70'}`}>
                    {r.text}
                  </span>
                ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
