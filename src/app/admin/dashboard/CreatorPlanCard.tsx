import ClanLink from '@/components/ClanLink';
import { ensureClanCheckoutRef } from '@/lib/billing';
import { creatorPlanCard, liveEventLimit } from '@/lib/creatorPlans';
import { biggestCreatorEvent, liveEventCount } from '@/lib/creatorPlansDb';
import { CREATOR_PLANS, creatorCheckoutUrlWithRef, creatorPlanOf } from '@/lib/creatorCatalog';

/**
 * A creator's plan, in plain words, on their dashboard (lib/creatorPlans): which plan, how full the
 * biggest event is, and the one tier worth looking at next with a button straight to its checkout.
 *
 * The checkout is the CREATOR catalogue's (lib/creatorCatalog creatorCheckoutUrlWithRef + the space's
 * `ref`): its own Gumroad products, never a clan tier. The webhook finds the space by that ref and
 * moves `clans.plan` within the creator catalogue. No checkout URL configured → no button.
 */
export default async function CreatorPlanCard({ clanId, clanPlan, canBuy }: { clanId: number; clanPlan: string; canBuy: boolean }) {
  const [biggest, live] = await Promise.all([biggestCreatorEvent(clanId), liveEventCount(clanId)]);
  const card = creatorPlanCard({ clanPlan, biggest });
  const plan = creatorPlanOf(clanPlan);
  const paying = plan.id !== 'creator_free';
  const next = card.next ? CREATOR_PLANS[card.next.id] : null;
  const ref = canBuy && next && !paying ? await ensureClanCheckoutRef(clanId) : null;
  const checkout = next && ref ? creatorCheckoutUrlWithRef(next, ref) : null;
  const cap = card.playersCap;
  const players = card.biggest?.players ?? 0;
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
          <dt className="text-[13px] text-text-muted">Biggest event</dt>
          <dd className="mt-0.5 text-[15px]">
            {card.biggest ? (
              <>
                {card.biggest.name}: <b>{players.toLocaleString('en-US')}</b>
                {cap != null ? ` / ${cap.toLocaleString('en-US')} players` : ' players (no cap)'}
              </>
            ) : (
              'No events yet'
            )}
          </dd>
          {cap != null && card.biggest && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-brown-dark" aria-hidden>
              <span className={`block h-full ${card.over ? 'bg-gold' : 'bg-accent-green-light'}`} style={{ width: `${pct}%` }} />
            </div>
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
            ? `Your event is full: new players can't join. ${next ? `Upgrade to ${next.name} for ${(next.playersPerEvent ?? 0).toLocaleString('en-US')} players.` : 'Get in touch about a Partner plan.'}`
            : `That's more than ${card.planName} allows. Everyone still gets in while Anvil is growing; the limit starts later, with notice.`}
        </p>
      )}

      {next && card.next && (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold/[0.05] p-4">
          <p className="text-[15px] font-semibold">
            {next.name}: ${next.priceUsd} a month
          </p>
          <ul className="mt-1.5 grid gap-1 text-[13.5px] text-text-muted">
            <li>Up to {(next.playersPerEvent ?? 0).toLocaleString('en-US')} players per event</li>
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
