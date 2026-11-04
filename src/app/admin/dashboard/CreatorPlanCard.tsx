import ClanLink from '@/components/ClanLink';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { creatorPlanCard, liveEventLimit } from '@/lib/creatorPlans';
import { creatorSeatMeter, liveEventCount } from '@/lib/creatorPlansDb';
import { CREATOR_PLANS, creatorCheckoutUrlWithRef, creatorPlanOf } from '@/lib/creatorCatalog';

/**
 * A creator's plan, in plain words, on their dashboard (lib/creatorPlans): which plan, the most
 * players at once across their events (events whose dates overlap share the cap; one person on two
 * boards counts on both), each current event's own count, and the one tier worth looking at next
 * with a button straight to its checkout.
 *
 * The checkout is the CREATOR catalogue's (lib/creatorCatalog creatorCheckoutUrlWithRef + the space's
 * `ref`): its own Gumroad products, never a clan tier. The webhook finds the space by that ref and
 * moves `clans.plan` within the creator catalogue. No checkout URL configured → no button.
 */
export default async function CreatorPlanCard({ clanId, clanPlan, canBuy }: { clanId: number; clanPlan: string; canBuy: boolean }) {
  const [meter, live] = await Promise.all([creatorSeatMeter(clanId), liveEventCount(clanId)]);
  const card = creatorPlanCard({ clanPlan, meter });
  const plan = creatorPlanOf(clanPlan);
  const paying = plan.id !== 'creator_free';
  const next = card.next ? CREATOR_PLANS[card.next.id] : null;
  const ref = canBuy && next && !paying ? await ensureClanCheckoutRef(clanId) : null;
  const checkout = next && ref ? creatorCheckoutUrlWithRef(next, ref) : null;
  const cap = card.playersCap;
  const players = meter?.peak ?? 0;
  const fmt = (n: number) => n.toLocaleString('en-US');
  const pct = cap ? Math.min(100, Math.round((players / cap) * 100)) : 0;
  const liveLimit = liveEventLimit(plan);

  return (
    <section id="plan" className="scroll-mt-24 rounded-xl border border-card-border bg-card-bg p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Your plan: {card.planName}</h2>
        {paying && (
          <ClanLink href="/portal" className="text-[13px] text-gold hover:text-gold-light">
            Manage billing
          </ClanLink>
        )}
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[13px] text-text-muted">
            {meter && !meter.current ? 'Biggest past event' : 'Players at once across your events'}
          </dt>
          <dd className="mt-0.5 text-[15px]">
            {meter ? (
              <>
                <b>{fmt(players)}</b>
                {cap != null ? ` / ${fmt(cap)} players` : ' players (no cap)'}
                {meter.peakEvents.length > 1 && (
                  <span className="text-text-muted"> · {meter.peakEvents.map((e) => e.name).join(' + ')} overlap</span>
                )}
                {meter.peakEvents.length === 1 && <span className="text-text-muted"> · {meter.peakEvents[0].name}</span>}
              </>
            ) : (
              'No events yet'
            )}
          </dd>
          {cap != null && meter && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brown-dark" aria-hidden>
              <span className={`block h-full ${card.over ? 'bg-gold' : 'bg-accent-green-light'}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-1.5 text-[12.5px] leading-snug text-text-muted">
            Counted per event they’re in. Events whose dates overlap share this; events apart get it each.
          </p>
          {meter && meter.events.length > 1 && (
            <ul className="mt-2 grid gap-0.5 text-[13px] text-text-muted">
              {meter.events.slice(0, 6).map((e) => (
                <li key={`${e.name}-${e.when}-${e.players}`}>
                  {e.name}: <span className="text-foreground">{fmt(e.players)}</span>
                  {e.when === 'draft' ? ' (no dates yet)' : e.when === 'upcoming' ? ' (upcoming)' : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <dt className="text-[13px] text-text-muted">Events running at once</dt>
          <dd className="mt-0.5 text-[15px]">
            {liveLimit != null ? `${live} of ${liveLimit}` : `${live} (no limit)`}
          </dd>
        </div>
      </dl>

      {card.over && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-text-muted">
          {card.enforced
            ? `You're over your plan's players at once: new players can't join events running at the same time. ${next ? `Upgrade to ${next.name} for ${fmt(next.playersPerEvent ?? 0)} players at once.` : 'Get in touch about a Partner plan.'}`
            : `That's more than ${card.planName} allows. Everyone still gets in while Anvil is growing; the limit starts later, with notice.`}
        </p>
      )}

      {next && card.next && (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/[0.05] p-4">
          <p className="text-[15px] font-semibold">
            {next.name}: ${next.priceUsd} a month
          </p>
          <ul className="mt-1.5 grid gap-1 text-[13.5px] text-text-muted">
            <li>Up to {fmt(next.playersPerEvent ?? 0)} players at once across your events</li>
            {card.next.perks.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {checkout && (
              <a
                // eslint-disable-next-line clan-scope/clan-prefix -- external Gumroad checkout, never a clan path
                href={checkout}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brown-dark transition-colors hover:bg-gold-light"
              >
                Upgrade to {next.name}
              </a>
            )}
            <ClanLink href="/pricing#creators" className="text-[13px] text-gold hover:text-gold-light">
              Compare plans
            </ClanLink>
          </div>
        </div>
      )}
    </section>
  );
}
