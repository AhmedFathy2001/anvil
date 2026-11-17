'use client';

import { itemIconUrl } from '@/lib/tileIcons';
import { formatCount, formatMultiple, formatOdds, formatRate } from '@/lib/clogLuck';
import { formatSources, type LuckEntry } from '@/lib/clogProfile';
import ClanLink from '@/components/ClanLink';
import { useState } from 'react';

// Who the game has been cruel to, and who it hasn't. Both boards read from synced collection logs
// crossed with hiscores kill counts and the wiki's drop rates — so an entry is a claim we can show
// the working for, which is the only kind worth putting someone's name next to.

interface Props {
  dry: LuckEntry[];
  spooned: LuckEntry[];
  membersConsidered: number;
  itemsConsidered: number;
  /** The last seven days, from kills gained and drops the plugin reported (lib/weekLuck). */
  week?: { dry: LuckEntry[]; spooned: LuckEntry[]; judged: number; members: number } | null;
}

function Row({
  rsn,
  itemId,
  itemName,
  source,
  headline,
  detail,
  tone,
}: {
  rsn: string;
  itemId: number;
  itemName: string;
  source: string;
  headline: string;
  detail: string | null;
  tone: 'dry' | 'spoon';
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={itemIconUrl(itemId)} alt="" className="w-8 h-8 object-contain shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm truncate">
          <ClanLink href={`/members/${encodeURIComponent(rsn)}`} className="font-medium hover:text-gold transition-colors">
            {rsn}
          </ClanLink>
          <span className="text-text-muted"> · {itemName}</span>
        </div>
        <div className="text-[11px] text-text-muted truncate">
          {source}
          {detail && <> · {detail}</>}
        </div>
      </div>
      <span
        className={`text-xs font-mono font-medium shrink-0 ${tone === 'dry' ? 'text-red-400' : 'text-accent-green-light'}`}
      >
        {headline}
      </span>
    </div>
  );
}

export default function ClanLuck({ dry, spooned, membersConsidered, itemsConsidered, week = null }: Props) {
  // All time is the board with something on it for every clan; the week is a tap away.
  const [span, setSpan] = useState<'all' | 'week'>('all');
  const spans = week ? (
    <div role="radiogroup" aria-label="Luck over" className="inline-flex rounded-lg border border-card-border p-0.5 text-xs">
      {([['week', 'This week'], ['all', 'All time']] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={span === key}
          onClick={() => setSpan(key)}
          className={`min-h-8 rounded-md px-3 transition-colors ${span === key ? 'bg-gold/15 text-gold' : 'text-text-muted hover:text-foreground'}`}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  if (week && span === 'week') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="min-w-0 flex-1 text-xs text-text-muted">
            The last seven days: drops the Anvil plugin reported, against the kills gained in the same days and the wiki&rsquo;s rate.{' '}
            {week.judged} of {week.members} {week.members === 1 ? 'member' : 'members'} had the plugin running, and only they are judged: without it
            we saw none of their drops. A week is a small sample, so someone is only called dry once they have done enough kills to expect a drop.
          </p>
          {spans}
        </div>
        <LuckColumns
          dry={week.dry}
          spooned={week.spooned}
          kcLabel="KC this week"
          emptyDry="Nobody has done enough kills without a drop this week to call it dry."
          emptySpooned="No drop this week has beaten its odds by enough to call it. Yet."
        />
      </div>
    );
  }

  if (membersConsidered === 0) {
    return (
      <div className="space-y-4">
      {/* The week needs no synced log (it reads the plugin's drops), so it stays reachable from here. */}
      {spans && <div className="flex justify-end">{spans}</div>}
      <div className="border border-dashed border-card-border rounded-xl p-8 text-center">
        <p className="text-sm text-text-muted">Nobody has synced a collection log yet.</p>
        <p className="text-xs text-text-muted/70 mt-2">
          These boards need one: without a log we can&rsquo;t tell &ldquo;hasn&rsquo;t got it&rdquo; from
          &ldquo;hasn&rsquo;t told us&rdquo;. In RuneLite, the Anvil tab has a{' '}
          <span className="text-gold">Sync profile</span> button.
        </p>
      </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-text-muted">
        Drawn from {membersConsidered} synced log{membersConsidered === 1 ? '' : 's'} against{' '}
        {itemsConsidered} rare drops: how many of each someone has, against how many their kill count
        and the wiki&rsquo;s rate say they should. Sitting near the rate is neither — only the tails
        appear here. Bosses only, since a clue item has no kill count to measure against.
      </p>
      {spans && <div className="flex justify-end">{spans}</div>}

      <LuckColumns dry={dry} spooned={spooned} />
    </div>
  );
}

/** The two columns, shared by the clan boards and an event's (app/events/[eventId]/EventLuck). */
export function LuckColumns({
  dry,
  spooned,
  kcLabel = 'KC',
  emptyDry = 'Everyone is inside the ordinary range. Enjoy it while it lasts.',
  emptySpooned = 'Nobody is far enough ahead of their kill count to call it. Yet.',
}: {
  dry: LuckEntry[];
  spooned: LuckEntry[];
  /** "KC", or "KC this event" when the kills are an event's gains. */
  kcLabel?: string;
  emptyDry?: string;
  emptySpooned?: string;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <span className="w-1 h-5 bg-red-500 rounded-full" />
          Dry
          <span className="text-xs text-text-muted font-normal">fewest drops for the kills</span>
        </h3>
        {dry.length === 0 ? (
          <div className="border border-dashed border-card-border rounded-xl p-6 text-center text-xs text-text-muted">
            {emptyDry}
          </div>
        ) : (
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
            {dry.map((e) => (
              <Row
                key={`${e.accountId}-${e.itemId}`}
                rsn={e.rsn}
                itemId={e.itemId}
                itemName={e.itemName}
                source={e.source}
                tone="dry"
                headline={formatCount(e.assessment.obtained, e.assessment.expected, e.assessment.expectedLow)}
                detail={[
                  `${e.assessment.kills.toLocaleString()} ${kcLabel}`,
                  formatSources(e.sources),
                  formatOdds(e.assessment.tail) ? `${formatOdds(e.assessment.tail)} end up here` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold flex items-center gap-2 mb-2">
          <span className="w-1 h-5 bg-accent-green rounded-full" />
          Spooned
          <span className="text-xs text-text-muted font-normal">most drops for the kills</span>
        </h3>
        {spooned.length === 0 ? (
          <div className="border border-dashed border-card-border rounded-xl p-6 text-center text-xs text-text-muted">
            {emptySpooned}
          </div>
        ) : (
          <div className="border border-card-border rounded-xl bg-card-bg divide-y divide-card-border">
            {spooned.map((e) => (
              <Row
                key={`${e.accountId}-${e.itemId}`}
                rsn={e.rsn}
                itemId={e.itemId}
                itemName={e.itemName}
                source={e.source}
                tone="spoon"
                headline={formatCount(e.assessment.obtained, e.assessment.expected, e.assessment.expectedLow)}
                detail={[
                  `${e.assessment.kills.toLocaleString()} ${kcLabel}`,
                  formatSources(e.sources),
                  formatOdds(e.assessment.tail) ? `${formatOdds(e.assessment.tail)} end up here` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
