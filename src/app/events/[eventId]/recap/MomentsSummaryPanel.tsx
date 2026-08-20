import type { MomentsSummary } from '@/lib/momentsAnalytics';
import { kindEmoji } from '@/lib/momentsAnalytics';

/**
 * The highlight feed, counted (lib/momentsAnalytics).
 *
 * The superlatives above answer "who won what". This answers the questions people ask each other
 * afterwards — how many times did we die, what kept killing us, what was the best thing anyone
 * pulled — which a feed of four hundred single lines cannot.
 *
 * Everything here is client-reported, like the feed itself, so it is presented as what was SEEN
 * rather than as a standing. Nothing on this panel scores.
 */

function gp(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}b`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return value.toLocaleString();
}

function Tile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg px-4 py-3 text-center">
      <p className="text-lg leading-none mb-1" aria-hidden>{emoji}</p>
      <p className="text-xl font-extrabold text-gold tabular-nums">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function Standout({
  emoji,
  title,
  who,
  what,
  detail,
}: {
  emoji: string;
  title: string;
  who: string;
  what: string;
  detail?: string | null;
}) {
  return (
    <div className="border border-card-border rounded-xl bg-card-bg p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl leading-none" aria-hidden>{emoji}</span>
        <p className="font-bold text-gold leading-tight">{title}</p>
      </div>
      <p className="font-semibold truncate">{what}</p>
      <p className="text-xs text-text-muted truncate">
        {who}
        {detail ? ` · ${detail}` : ''}
      </p>
    </div>
  );
}

export default function MomentsSummaryPanel({
  summary,
  sides = [],
}: {
  summary: MomentsSummary;
  /**
   * The same feed split by the side it happened on. Empty on a board with no teams, and on one with
   * a single team — a comparison of one is not a comparison. On a clan-v-clan it's the whole point:
   * "who died more" is a question about SIDES, and the answer was only ever available per person.
   */
  sides?: { teamId: number; name: string; color: string; summary: MomentsSummary }[];
}) {
  const { counts, deathBoard, killers, members, biggestHaul, rarestDrop, hardestTask } = summary;
  if (counts.total === 0) return null;

  const topLooters = members.filter((m) => m.lootGp > 0).slice(0, 8);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-bold">By the numbers</h2>
        <span className="text-xs text-text-muted">everything the plugin saw happen, counted</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <Tile emoji={kindEmoji('death')} value={counts.death.toLocaleString()} label="deaths" />
        <Tile emoji={kindEmoji('pet')} value={counts.pet.toLocaleString()} label="pets" />
        <Tile emoji={kindEmoji('unique')} value={counts.unique.toLocaleString()} label="uniques" />
        <Tile emoji={kindEmoji('loot')} value={counts.loot.toLocaleString()} label="big hauls" />
        <Tile emoji={kindEmoji('ca')} value={counts.ca.toLocaleString()} label="combat tasks" />
        <Tile emoji="💰" value={`${gp(summary.gpSeen)} gp`} label="value seen" />
      </div>

      {sides.length > 1 && (
        <div className="mb-4 grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          {sides.map((side) => (
            <div
              key={side.teamId}
              className="rounded-xl border bg-card-bg p-3.5"
              style={{ borderColor: `${side.color}55` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span aria-hidden className="h-5 w-1 rounded-full" style={{ background: side.color }} />
                <span className="font-semibold truncate" style={{ color: side.color }}>
                  {side.name}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <SideStat value={side.summary.counts.death} label="deaths" />
                <SideStat value={side.summary.counts.pet + side.summary.counts.unique} label="uniques" />
                <SideStat value={side.summary.counts.ca} label="tasks" />
              </div>
              <div className="mt-2 text-center text-xs text-text-muted">
                <span className="text-gold font-semibold">{gp(side.summary.gpSeen)} gp</span> seen
                {side.summary.deathBoard[0] && (
                  <>
                    {' · '}
                    most deaths: {side.summary.deathBoard[0].rsn} ({side.summary.deathBoard[0].deaths})
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(biggestHaul || rarestDrop || hardestTask) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          {biggestHaul && (
            <Standout
              emoji="💰"
              title="Most valuable"
              what={`${biggestHaul.itemName ?? 'Something'} · ${gp(biggestHaul.valueGp ?? 0)} gp`}
              who={biggestHaul.rsn}
              detail={biggestHaul.source}
            />
          )}
          {rarestDrop && (
            <Standout
              emoji="✨"
              title="Rarest"
              what={`${rarestDrop.itemName ?? 'Something'} · 1 in ${(rarestDrop.rarityDenominator ?? 0).toLocaleString()}`}
              who={rarestDrop.rsn}
              detail={rarestDrop.source}
            />
          )}
          {hardestTask && (
            <Standout
              emoji="⚔️"
              title="Hardest task"
              what={`${hardestTask.tier ?? ''} · ${hardestTask.itemName ?? 'a combat task'}`.replace(/^ · /, '')}
              who={hardestTask.rsn}
              detail={hardestTask.source}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {deathBoard.length > 0 && (
          <div className="border border-card-border rounded-xl bg-card-bg p-4">
            <p className="font-semibold mb-2">Deaths per player</p>
            <ul className="space-y-1 text-sm">
              {deathBoard.map((m) => (
                <li key={m.rsn} className="flex items-center justify-between gap-2">
                  <span className="truncate">{m.rsn}</span>
                  <span className="tabular-nums text-text-muted">{m.deaths}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {killers.length > 0 && (
          <div className="border border-card-border rounded-xl bg-card-bg p-4">
            <p className="font-semibold mb-2">What killed us</p>
            <ul className="space-y-1 text-sm">
              {killers.map((k) => (
                <li key={k.name} className="flex items-center justify-between gap-2">
                  <span className="truncate">{k.name}</span>
                  <span className="tabular-nums text-text-muted">{k.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {topLooters.length > 0 && (
          <div className="border border-card-border rounded-xl bg-card-bg p-4">
            <p className="font-semibold mb-2">Value seen per player</p>
            <ul className="space-y-1 text-sm">
              {topLooters.map((m) => (
                <li key={m.rsn} className="flex items-center justify-between gap-2">
                  <span className="truncate">{m.rsn}</span>
                  <span className="tabular-nums text-text-muted">{gp(m.lootGp)} gp</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

/** One number on a side's card — small, because three of them sit in a row on a phone. */
function SideStat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-lg font-extrabold tabular-nums leading-tight">{value.toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  );
}
