import ClanLink from '@/components/ClanLink';
import type { UnmatchedPurchaseRow } from '@/lib/unmatchedPurchases';
import UnmatchedPurchaseActions from './UnmatchedPurchaseActions';

const REASON: Record<string, string> = {
  'no-ref': 'No checkout ref matched a space',
  'cross-catalogue': 'Other catalogue through a checkout',
  'no-buyer': 'No checkout ref matched a person',
};

const KIND: Record<string, string> = { plan: 'Clan plan', creator: 'Creator plan', supporter: 'Supporter' };

/** What Gumroad has said since, when it is worth a colour. */
const STATE_TONE: Record<string, string> = {
  cancelled: 'text-yellow-400',
  ended: 'text-red-400',
  refunded: 'text-red-400',
  disputed: 'text-red-400',
  renewed: 'text-emerald-400',
};

function when(stamp: string | null): string {
  return stamp ? stamp.replace('T', ' ').slice(0, 16) : '—';
}

function price(r: UnmatchedPurchaseRow): string | null {
  if (r.priceCents == null) return null;
  return `${(r.priceCents / 100).toFixed(2)} ${(r.currency ?? 'usd').toUpperCase()}`;
}

/**
 * Gumroad purchases the webhook could not place (lib/unmatchedPurchases): open ones first, oldest at
 * the top, then the latest resolved. The buyer's email is unverified and shown here only.
 */
export default function UnmatchedPurchases({
  open,
  resolved,
  canResolve,
}: {
  open: UnmatchedPurchaseRow[];
  resolved: UnmatchedPurchaseRow[];
  canResolve: boolean;
}) {
  if (open.length === 0 && resolved.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="h-5 w-1 bg-gold" />
        Unmatched purchases
        <span className={`text-sm font-normal ${open.length ? 'text-yellow-400' : 'text-gray-500'}`}>· {open.length} open</span>
      </h2>
      <p className="mt-1 max-w-[80ch] text-sm text-gray-400">
        Sales Gumroad sent that matched no space or person: no checkout ref, or a product from the other catalogue
        bought through a space&rsquo;s checkout. Attaching applies it exactly as a matched sale would.
        {!canResolve && ' Only root can attach or dismiss.'}
      </p>
      <ul className="mt-3 divide-y divide-card-border overflow-hidden rounded-xl border border-card-border bg-card-bg">
        {[...open, ...resolved].map((r) => (
          <li key={r.id} className={`px-4 py-3 sm:px-5 ${r.status === 'open' ? '' : 'opacity-70'}`}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-gray-500">{when(r.receivedAt)}</span>
              <span className="text-[14px]">{r.productName ?? r.productPermalink ?? r.productId ?? 'Unknown product'}</span>
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-300">{KIND[r.kind] ?? r.kind}</span>
              {r.tier && <span className="text-[13px] text-gray-300">{r.tier}</span>}
              {r.planId == null && <span className="text-[12px] text-yellow-400">tier not recognised</span>}
              {r.recurrence && <span className="text-[13px] capitalize text-gray-400">{r.recurrence}</span>}
              {price(r) && <span className="text-[13px] tabular-nums text-gray-400">{price(r)}</span>}
              {r.gumroadState !== 'sold' && (
                <span className={`text-[12.5px] ${STATE_TONE[r.gumroadState] ?? 'text-gray-400'}`}>
                  Gumroad since: {r.gumroadState}
                  {r.lastEventAt ? ` (${when(r.lastEventAt)})` : ''}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-gray-400">
              <span>{REASON[r.reason] ?? r.reason}</span>
              {r.refClan && (
                <span>
                  came through{' '}
                  <ClanLink href={`/staff/clans/${r.refClan.id}`} className="text-gold hover:underline">
                    {r.refClan.name}
                  </ClanLink>
                  &rsquo;s checkout ({r.refClan.kind === 'creator' ? 'creator space' : 'clan'})
                </span>
              )}
              {!r.refClan && r.ref && <span>ref “{r.ref}” (no such space)</span>}
              <span>buyer {r.buyerEmail ?? '—'}</span>
              <span className="font-mono text-[11.5px] text-gray-500">
                sale {r.gumroadSaleId ?? '—'} · sub {r.gumroadSubscriptionId ?? '—'}
              </span>
            </div>
            {r.status === 'open' ? (
              canResolve && (
                <div className="mt-2">
                  <UnmatchedPurchaseActions id={r.id} kind={r.kind as 'plan' | 'creator' | 'supporter'} />
                </div>
              )
            ) : (
              <div className="mt-1 text-[12.5px] text-gray-400">
                <span className={r.status === 'attached' ? 'text-emerald-400' : 'text-gray-300'}>
                  {r.status === 'attached' ? 'Attached' : 'Dismissed'}
                </span>
                {r.attachedClan && (
                  <>
                    {' to '}
                    <ClanLink href={`/staff/clans/${r.attachedClan.id}`} className="text-gold hover:underline">
                      {r.attachedClan.name}
                    </ClanLink>
                  </>
                )}
                {r.attachedUser && ` to ${r.attachedUser.name} (login #${r.attachedUser.id})`}
                {r.resolvedBy && ` by ${r.resolvedBy}`}
                {r.resolvedAt && ` · ${when(r.resolvedAt)}`}
                {r.resolutionNote && ` · “${r.resolutionNote}”`}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
