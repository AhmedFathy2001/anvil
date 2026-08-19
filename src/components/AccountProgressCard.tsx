import type { ProgressSummary } from '@/lib/memberProgress';
import type { ProgressItem } from '@/lib/memberProgressItems';
import ProgressItemBrowser from '@/components/ProgressItemBrowser';

/**
 * Quest points, combat achievements and achievement diaries, laid out the way a player is used to
 * seeing them: the diary grid says WHICH region and tier, not just how many, and the combat tiers
 * light up cumulatively.
 *
 * Shown on a member's public record and on their own locker, from the same data (lib/memberProgress,
 * pushed by the plugin). A member whose plugin hasn't pushed yet gets no card rather than a wall of
 * zeroes — "we were never told" and "they have none" are different facts.
 */

const TIER_STATE = {
  done: 'bg-accent-green/25 text-accent-green-light border-accent-green/40',
  todo: 'bg-brown-dark border-card-border text-text-muted/50',
  unknown: 'bg-brown-dark border-dashed border-card-border text-text-muted/40',
} as const;

function Figure({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
      <p className="text-2xl font-extrabold text-gold tabular-nums leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-text-muted">{sub}</p>}
    </div>
  );
}

export default function AccountProgressCard({
  summary,
  title = 'Account progress',
  quests = null,
}: {
  summary: ProgressSummary;
  title?: string;
  /** Every quest with its state, when the plugin has sent the list. */
  quests?: { items: ProgressItem[]; done: number; total: number } | null;
}) {
  if (summary.empty && !quests) return null;
  const { questPoints, questsCompleted, caPoints, caTiers, caTier, regions } = summary;
  const anyUnknown = regions.some((r) => r.tiers.some((t) => t.state === 'unknown'));

  return (
    <section className="border border-card-border rounded-xl bg-card-bg p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1 h-5 bg-gold rounded-full" />
        <h2 className="font-semibold">{title}</h2>
        <span className="text-[11px] text-text-muted ml-auto">the numbers the hiscores don&apos;t carry</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        {questPoints != null && (
          <Figure
            label="Quest points"
            value={questPoints.toLocaleString()}
            sub={questsCompleted != null ? `${questsCompleted} quests finished` : null}
          />
        )}
        {caPoints != null && (
          <Figure label="Combat achievements" value={`${caPoints.toLocaleString()} pts`} sub={`${caTier} cleared`} />
        )}
        {summary.diariesKnowable > 0 && (
          <Figure
            label="Diaries"
            value={`${summary.diariesDone}/${summary.diariesKnowable}`}
            sub="region tiers finished"
          />
        )}
      </div>

      {caPoints != null && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {caTiers.map((t) => (
            <span
              key={t.name}
              className={`text-[11px] font-semibold px-2 py-1 rounded-lg border ${
                t.cleared
                  ? 'bg-gold/15 text-gold border-gold/30'
                  : 'bg-brown-dark text-text-muted/50 border-card-border'
              }`}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {regions.length > 0 && (
        <>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {regions.map((region) => (
              <div key={region.key} className="flex items-center gap-2">
                <span className="text-sm truncate flex-1 min-w-0">{region.label}</span>
                <div className="flex gap-1 shrink-0">
                  {region.tiers.map((tier) => (
                    <span
                      key={tier.label}
                      title={`${tier.label}${tier.state === 'unknown' ? ' — not readable' : ''}`}
                      className={`w-7 text-center text-[10px] font-bold py-0.5 rounded border ${TIER_STATE[tier.state]}`}
                    >
                      {tier.state === 'unknown' ? '?' : tier.short}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {anyUnknown && (
            <p className="text-[11px] text-text-muted mt-3">
              Karamja&apos;s easy, medium and hard tiers have no completion flag in the game, so they
              show as unknown rather than as unfinished.
            </p>
          )}
        </>
      )}

      {quests && (
        <ProgressItemBrowser items={quests.items} label="Quests" done={quests.done} total={quests.total} />
      )}
    </section>
  );
}
