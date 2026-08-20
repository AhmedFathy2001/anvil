import type { LockerBests, LockerTrophy } from '@/lib/profileLocker';
import type { UpcomingMilestone } from '@/lib/memberProfile';
import ClanLink from '@/components/ClanLink';

// The right-hand rail: what you've won, what you've hit, what you're near. All derived — nothing
// here is a new thing to track, and nothing here scores.

function Card({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="text-lg font-semibold">{title}</h2>
        {note && <span className="ml-auto text-xs text-text-muted">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * The case shows locked slots as well as earned ones. An empty trophy case that says nothing is
 * just a blank card; one that shows five outlines says what's collectable here.
 */
export function TrophyCase({ trophies }: { trophies: LockerTrophy[] }) {
  const earned = trophies.filter((t) => t.earned).length;
  return (
    <Card
      title="Trophy case"
      // "7 of 7" says nothing once there's nothing left to collect — count up, not out of.
      note={earned === trophies.length ? `${earned} earned` : `${earned} of ${trophies.length}`}
    >
      <div className="grid grid-cols-3 gap-2.5">
        {trophies.map((t) => (
          <div
            key={t.key}
            title={t.earned ? `${t.label}${t.value ? ` — ${t.value}` : ''}` : `Not yet: ${t.value ?? t.label}`}
            className={`relative flex flex-col items-center text-center rounded-lg px-1.5 pt-3 pb-2.5 min-h-[104px] border ${
              t.earned ? 'border-card-border bg-brown-dark/50' : 'border-dashed border-card-border opacity-55'
            }`}
          >
            {t.count && (
              <span className="absolute top-1.5 right-1.5 font-mono text-[10px] font-bold text-gold-light bg-gold/15 rounded-full px-1.5">
                ×{t.count}
              </span>
            )}
            <span
              className={`w-10 h-10 rounded-full grid place-items-center text-lg mb-1.5 border ${
                t.earned ? 'bg-gold/12 border-gold/30' : 'border-card-border grayscale'
              }`}
              aria-hidden
            >
              {t.emoji}
            </span>
            <span className="text-[11.5px] font-bold leading-tight">{t.label}</span>
            {t.value && (
              <span className="font-mono text-[10px] text-text-muted leading-tight mt-auto pt-1 truncate max-w-full">
                {t.value}
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const PERIOD_LABEL: Record<string, string> = { day: 'Best day', week: 'Best week', month: 'Best month' };

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toLocaleString();
}

/** Rolling XP records and where this person sits in the clan. Both are per-account by nature. */
export function PersonalBests({ bests, focusRsn }: { bests: LockerBests; focusRsn: string | null }) {
  const xpRecords = bests.records.filter((r) => r.metric === 'xp');
  if (xpRecords.length === 0 && bests.standings.length === 0) return null;

  return (
    <Card title="Personal bests" note={focusRsn}>
      {xpRecords.length > 0 && (
        <div className="grid gap-2.5">
          {(['day', 'week', 'month'] as const).map((period) => {
            const row = xpRecords.find((r) => r.period === period);
            if (!row) return null;
            return (
              <div key={period} className="flex items-baseline gap-2.5 text-sm">
                <span className="text-text-muted">{PERIOD_LABEL[period]}</span>
                <span className="ml-auto font-mono font-bold tabular-nums">{compact(row.value)}</span>
                <span className="font-mono text-[11px] text-text-muted w-14 text-right">
                  {new Date(`${row.endedOn}T00:00:00Z`).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {bests.standings.length > 0 && (
        <>
          {xpRecords.length > 0 && <div className="h-px bg-card-border my-3.5" />}
          <div className="grid gap-2.5">
            {bests.standings.map((s) => (
              <div key={s.label} className="flex items-baseline gap-2.5 text-sm">
                <span className="text-text-muted">{s.label}</span>
                <span className="ml-auto font-mono font-bold tabular-nums">#{s.place}</span>
                <span className="font-mono text-[11px] text-text-muted w-14 text-right">of {s.outOf}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/** The milestone log looks backwards; this is the question a player actually asks. */
export function InReach({ milestones }: { milestones: UpcomingMilestone[] }) {
  if (milestones.length === 0) return null;
  return (
    <Card title="In reach" note="nearly there">
      <div className="grid gap-3.5">
        {milestones.map((m) => (
          <div key={m.label}>
            <div className="flex gap-2.5 text-sm">
              <span className="truncate">{m.label}</span>
              <span className="ml-auto font-mono text-[11.5px] text-text-muted shrink-0">{m.remaining}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-brown-light overflow-hidden">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.min(100, Math.round(m.progress * 100))}%`,
                  background: 'linear-gradient(90deg, var(--gold-dark), var(--gold-light))',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/** The version of this page the rest of the clan sees. */
export function PublicProfile({ rsn }: { rsn: string }) {
  return (
    <Card title="Public profile">
      <p className="text-sm text-text-muted mb-3">
        Skills, boss KC, milestones and every event you&rsquo;ve played — the version the rest of the clan
        sees.
      </p>
      <ClanLink
        href={`/members/${encodeURIComponent(rsn)}`}
        className="inline-block text-sm font-semibold px-3.5 py-2 border border-card-border rounded-lg hover:border-gold/40 hover:bg-gold/5 transition-colors"
      >
        View as clan →
      </ClanLink>
    </Card>
  );
}
