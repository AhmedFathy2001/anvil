import ClanLink from '@/components/ClanLink';
import SupporterName from '@/components/SupporterName';
import { tenureStep, type SupporterState, type SupporterTierId } from '@/lib/supporterTiers';

/** What the profile needs to show someone's Supporter status (serialisable for client islands). */
export interface SupporterView {
  tier: SupporterTierId;
  tierName: string;
  since: string;
  months: number;
  renewsAt: string | null;
  endsAt: string | null;
}

export function supporterView(state: SupporterState | null): SupporterView | null {
  if (!state) return null;
  return {
    tier: state.tier.id,
    tierName: state.tier.name,
    since: state.since,
    months: state.months,
    renewsAt: state.renewsAt,
    endsAt: state.endsAt,
  };
}

function day(stamp: string | null): string | null {
  if (!stamp) return null;
  const ms = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The Anvil Supporter block on "your account across Anvil". A supporter sees their tier, tenure and
 * when it renews or ends, with a way to change tier or manage the subscription. Someone who isn't
 * supporting sees one quiet line pointing at the tier page: never a pitch to someone already paying.
 */
export default function SupporterSection({ supporter }: { supporter: SupporterView | null }) {
  if (!supporter) {
    return (
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Anvil Supporter</h2>
        <ClanLink
          href="/supporter"
          className="flex items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg p-4 transition-colors hover:border-gold/40"
        >
          <span>
            <span className="block font-medium text-foreground">Help keep Anvil running</span>
            <span className="mt-0.5 block text-sm text-text-muted">
              Supporters pay for the servers that keep Anvil free for every clan, and get name flair their
              clanmates can see. From $1 a month.
            </span>
          </span>
          <span className="text-gold" aria-hidden>
            →
          </span>
        </ClanLink>
      </section>
    );
  }

  const { next } = tenureStep(supporter.months);
  const renews = day(supporter.renewsAt);
  const ends = day(supporter.endsAt);
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">Anvil Supporter</h2>
      <div className="rounded-xl border border-gold/40 bg-gold/[0.05] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SupporterName name={`Anvil ${supporter.tierName}`} tier={supporter.tier} className="text-lg font-bold" plain />
          <span className="text-sm text-text-muted">
            Since {day(supporter.since)}
            {supporter.months > 0 && <> · {supporter.months} month{supporter.months === 1 ? '' : 's'}</>}
          </span>
        </div>
        <p className="mt-2 text-sm text-text-muted">
          {ends ? (
            <>Cancelled. Your perks stay until {ends}.</>
          ) : renews ? (
            <>Renews {renews}.</>
          ) : (
            <>Active.</>
          )}
          {next != null && <> Your flair gets a new look at {next} months.</>} Thank you for keeping Anvil
          running.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ClanLink
            href="/supporter"
            className="rounded-lg border border-gold/40 px-3 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Change tier
          </ClanLink>
          <a
            href="https://gumroad.com/library"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-text-muted transition-colors hover:border-gold/40"
          >
            Manage on Gumroad
          </a>
        </div>
      </div>
    </section>
  );
}
