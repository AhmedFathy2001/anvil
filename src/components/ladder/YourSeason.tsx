'use client';

import type { LadderMe } from '@/lib/ladderView';

/**
 * The viewer's own run, in the shape a player actually asks about it: how much, how many, how hot,
 * and — the one that keeps people coming back on a rolling board — is this week better than last.
 *
 * The projection is deliberately absent early on (lib/ladderInsights.projectSeason returns null
 * until there's enough season to extrapolate from) rather than shown as a wild number.
 */
export default function YourSeason({ me, word }: { me: LadderMe; word: string }) {
  const max = Math.max(1, ...me.weeks.map((w) => w.points));
  const labels = ['2 weeks ago', 'Last week', 'This week'];
  const best = me.weeks.length > 1 && me.weeks[me.weeks.length - 1].points >= max;

  return (
    <div className="mt-6 rounded-xl border border-accent-green/20 bg-gradient-to-b from-accent-green/10 to-card-bg p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
        <span className="h-4 w-1 rounded-full bg-gold" />
        Your {word}
        <span className="text-xs font-normal text-text-muted">{me.name}</span>
      </h3>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat k="Points" v={Math.round(me.points).toLocaleString()} tone="text-accent-green-light" />
        <Stat k="Tasks" v={String(me.tasks)} />
        <Stat k="Streak" v={me.streak > 0 ? `${me.streak}d` : '—'} tone={me.streak > 1 ? 'text-gold-light' : undefined} />
        <Stat k="Best claim" v={me.bestClaim ? me.bestClaim.points.toLocaleString() : '—'} />
      </div>

      {me.weeks.some((w) => w.points > 0) && (
        <div className="mt-4 grid h-28 grid-cols-3 gap-3">
          {me.weeks.map((w, i) => (
            <div key={i} className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5">
              <span className="text-center font-mono text-xs font-bold">{w.points.toLocaleString()}</span>
              <span className="flex items-end">
                <i
                  className={`block w-full rounded-t-md ${
                    i === me.weeks.length - 1
                      ? 'bg-gradient-to-b from-gold-light to-gold-dark/40'
                      : 'bg-gradient-to-b from-accent-green/70 to-accent-green/25'
                  }`}
                  style={{ height: `${Math.max(3, (w.points / max) * 100)}%` }}
                />
              </span>
              <span className="text-center font-mono text-[10px] text-text-muted">{labels[i] ?? `week ${i + 1}`}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3.5 text-xs leading-relaxed text-text-muted">
        {best && <span className="font-semibold text-gold-light">Your best week yet. </span>}
        {me.bestClaim && (
          <>
            Biggest claim: <span className="font-semibold text-foreground">{me.bestClaim.label}</span> for{' '}
            {me.bestClaim.points.toLocaleString()}.{' '}
          </>
        )}
        {me.projection !== null && (
          <>
            Keep this pace and you finish the {word} around{' '}
            <span className="font-semibold text-gold-light">{me.projection.toLocaleString()} pts</span>.
          </>
        )}
      </p>
    </div>
  );
}

function Stat({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-card-border bg-brown-dark/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-text-muted">{k}</div>
      <div className={`mt-1 font-mono text-lg font-bold leading-none tabular-nums ${tone ?? ''}`}>{v}</div>
    </div>
  );
}
