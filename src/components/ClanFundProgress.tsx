import { usd, type FundTotals } from '@/lib/clanFundRules';

/**
 * The clan fund's goal and how far it has come (lib/clanFund): the amount, a bar and how many members
 * chipped in. Never who gave what. Shared by the member page (/fund) and the owner's plan page.
 */
export default function ClanFundProgress({
  planName,
  totals,
  graceEndsAt = null,
}: {
  planName: string;
  totals: Pick<FundTotals, 'goal' | 'total' | 'left' | 'members' | 'funded' | 'pct'>;
  graceEndsAt?: number | null;
}) {
  const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[14px]">
        <span className="font-semibold">
          {usd(totals.total)} of {usd(totals.goal)} for {planName}
        </span>
        <span className="text-text-muted">
          {totals.members} member{totals.members === 1 ? '' : 's'} chipped in
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brown-dark" aria-hidden>
        <span className="block h-full rounded-full bg-gold" style={{ width: `${totals.pct}%` }} />
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
        {totals.funded
          ? `Fully funded: the clan is on ${planName}. Chip-ins are closed until it falls short.`
          : graceEndsAt
            ? `${usd(totals.left)} short. The clan keeps ${planName} until ${day(graceEndsAt)}, then moves to the free plan unless it's covered. Nothing is deleted.`
            : `${usd(totals.left)} to go. ${planName} for a year is ${usd(totals.goal)}; once chip-ins reach it, the clan is on ${planName}.`}
      </p>
    </div>
  );
}
