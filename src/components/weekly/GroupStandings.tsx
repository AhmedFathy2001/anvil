import type { CompetitionType } from '@/lib/competitionInsights';
import type { GroupStandingsView } from '@/lib/competitionTeamsDb';
import { exactValue, shortValue } from '@/components/weekly/format';

/**
 * Team / clan standings for a team or clan-vs-clan competition (lib/competitionTeams). Shown above
 * the individual board: each team/clan is a row with its total, per-player average and headcount,
 * and opens to that group's own individual standings. The viewer's group is highlighted and opens
 * by default. Server component — the expand is a native disclosure, no client JS.
 */
export default function GroupStandings({
  view,
  type,
  unit,
  myRsns,
}: {
  view: GroupStandingsView;
  type: CompetitionType;
  unit: string;
  /** The viewer's own RSNs (lower-cased) — marks "you" inside the expanded list. */
  myRsns: Set<string>;
}) {
  const noun = view.mode === 'clans' ? 'Clan' : 'Team';
  const leaderTotal = Math.max(view.groups[0]?.total ?? 0, 1);

  return (
    <section className="mb-7">
      <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-bold text-foreground">
        <span className="h-5 w-1 rounded-full bg-gold" />
        {noun} standings
        <span className="text-xs font-normal text-text-muted">
          {view.groups.length} {view.mode === 'clans' ? 'clans' : 'teams'} · total, average per player, players
        </span>
      </h2>

      {view.groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card-border py-8 text-center text-sm text-text-muted">
          {view.mode === 'clans' ? 'No clans have joined yet.' : 'No teams yet — an admin sets them up.'}
        </div>
      ) : (
        <div className="space-y-2">
          {view.groups.map((g) => {
            const colour = g.colour ?? '#d4a017';
            return (
              <details
                key={g.key}
                open={g.isYours}
                className={`group overflow-hidden rounded-xl border ${
                  g.isYours ? 'border-gold/60 bg-gradient-to-r from-gold/15 to-card-bg' : 'border-card-border bg-card-bg'
                }`}
              >
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="w-6 shrink-0 text-center font-mono text-sm font-bold text-text-muted">{g.rank}</span>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colour }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-foreground">{g.name}</span>
                      {g.isYours && (
                        <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold">
                          Your {noun.toLowerCase()}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-card-border/60">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${Math.round((g.total / leaderTotal) * 100)}%`, backgroundColor: colour }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm font-bold text-accent-green-light" title={exactValue(g.total, type)}>
                      +{shortValue(g.total, type)} {type === 'efficiency' ? '' : unit}
                    </span>
                    <span className="block text-[11px] text-text-muted">
                      {shortValue(Math.round(g.average), type)} avg · {g.members} {g.members === 1 ? 'player' : 'players'}
                    </span>
                  </span>
                  <span className="shrink-0 text-text-muted transition-transform group-open:rotate-90" aria-hidden>
                    ▸
                  </span>
                </summary>
                <div className="border-t border-card-border/60">
                  {g.entries.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-text-muted">Nobody on this {noun.toLowerCase()} yet.</p>
                  ) : (
                    g.entries.map((e) => {
                      const me = myRsns.has(e.rsn.toLowerCase());
                      return (
                        <div
                          key={e.rsn}
                          className={`grid items-center gap-3 border-b border-card-border/40 px-4 py-1.5 text-sm last:border-b-0 ${
                            me ? 'bg-accent-green/10 shadow-[inset_3px_0_0_#34d058]' : ''
                          }`}
                          style={{ gridTemplateColumns: '28px minmax(0,1fr) auto' }}
                        >
                          <span className="text-center font-mono text-xs text-text-muted">{e.rank}</span>
                          <span className="truncate text-foreground">
                            {e.rsn}
                            {me && <span className="ml-1.5 text-xs text-accent-green-light">you</span>}
                          </span>
                          <span className="font-mono text-accent-green-light">+{exactValue(e.gained, type)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </details>
            );
          })}

          {view.unassigned.length > 0 && (
            <p className="px-1 pt-1 text-xs text-text-muted">
              {view.unassigned.length} {view.unassigned.length === 1 ? 'player is' : 'players are'} on no team yet and count
              only on the individual board.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
