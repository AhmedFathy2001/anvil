import LocalTime from '@/components/LocalTime';

/**
 * The event, as the side that did not create it needs to read it.
 *
 * A visiting clan's manager arrives with a roster to run and no way to see the terms they are
 * running it under. The host has all of this on the event's admin pages, which a co-host cannot open
 * and should not need to: the dates, what the board is, what entry costs and — the one that actually
 * caused confusion — WHO IS HOLDING THE MONEY.
 *
 * Read-only by construction. Nothing here is a control; it is the half of the event that was only
 * ever written down on the other clan's screen.
 */
export interface EventBriefingProps {
  hostClan: string | null;
  cohosts: string[];
  format: string;
  scoringMode: string;
  startDate: string | null;
  endDate: string | null;
  tileCount: number;
  teamCount: number;
  signupFee: number | null;
  cashPolicy: string;
  weCollect: boolean;
}

/** How the money works, in a sentence — rather than a policy name nobody chose the words for. */
function cashLine(fee: number, policy: string, weCollect: boolean): string {
  const gp = `${fee.toLocaleString()} gp`;
  if (weCollect && policy === 'each-settles') {
    return `${gp} per player, and each clan keeps and settles its own entries.`;
  }
  if (weCollect) return `${gp} per player, which you collect from your own side.`;
  return `${gp} per player, collected by the host, who settles up with each clan afterwards.`;
}

export default function EventBriefing(p: EventBriefingProps) {
  const facts: [string, React.ReactNode][] = [
    ['Board', `${p.format}${p.scoringMode ? ` · ${p.scoringMode}` : ''}`],
    ['Tiles', p.tileCount.toLocaleString()],
    ['Teams', p.teamCount.toLocaleString()],
  ];

  return (
    <div className="mb-6 rounded-xl border border-card-border bg-card-bg p-4">
      <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span aria-hidden className="h-4 w-1 rounded-full bg-gold" />
        <h2 className="text-[15px] font-semibold">About this event</h2>
        {p.hostClan && (
          <span className="text-[11.5px] text-text-muted">
            hosted by {p.hostClan}
            {p.cohosts.length > 0 && ` · with ${p.cohosts.join(', ')}`}
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">{k}</dt>
            <dd className="text-[13.5px]">{v}</dd>
          </div>
        ))}
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">Runs</dt>
          <dd className="text-[13.5px]">
            {p.startDate ? <LocalTime date={p.startDate} format="date" /> : 'not scheduled'}
            {p.endDate && (
              <>
                {' – '}
                <LocalTime date={p.endDate} format="date" />
              </>
            )}
          </dd>
        </div>
      </dl>

      {p.signupFee != null && p.signupFee > 0 && (
        <p className="mt-3 border-t border-card-border pt-2.5 text-[13px] text-text-muted">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">Entry</span>{' '}
          {cashLine(p.signupFee, p.cashPolicy, p.weCollect)}
        </p>
      )}
    </div>
  );
}
