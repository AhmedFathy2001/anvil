import ClanLink from '@/components/ClanLink';
import { h2hProfileCard } from '@/lib/h2h';
import { recordLabel } from '@/lib/h2hRules';

/**
 * The profile's small head-to-head card (lib/h2h). Server component. Draws nothing for a stranger's
 * character with no public results and no way to challenge it.
 */
export default async function H2hCard({ accountId, rsn, viewerPlayerId }: { accountId: number; rsn: string; viewerPlayerId: number | null }) {
  const card = await h2hProfileCard(accountId, viewerPlayerId).catch(() => null);
  if (!card) return null;
  const played = card.record.wins + card.record.losses + card.record.ties;
  if (!card.owner && played === 0 && !card.canChallenge) return null;

  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-4 w-1 bg-gold" />
          Head-to-head
          {played > 0 && <span className="font-mono text-text-muted">{recordLabel(card.record)}</span>}
        </div>
        <div className="mt-0.5 text-xs text-text-dim">
          {card.lastWin
            ? `Won vs ${card.lastWin.rsn} · ${card.lastWin.label}`
            : card.owner
              ? 'Challenge a friend: first to a drop, or most kills or XP in a set time.'
              : played === 0
                ? 'No public results yet. Just for bragging rights.'
                : 'Just for bragging rights.'}
        </div>
      </div>
      {card.owner ? (
        <ClanLink href="/challenges" className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm text-gold hover:bg-gold/10">
          {card.pending > 0 ? `${card.pending} waiting on you →` : 'Your challenges →'}
        </ClanLink>
      ) : card.canChallenge ? (
        <ClanLink
          href={`/challenges?rsn=${encodeURIComponent(rsn)}`}
          className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
        >
          Challenge {rsn}
        </ClanLink>
      ) : null}
    </section>
  );
}
