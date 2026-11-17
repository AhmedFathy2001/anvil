import { and, desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanExtraMemberships, ownerTrials, users } from '@/db/schema';
import { clanBuy, creatorBuy, soonReason } from '@/lib/buyOffer';
import { CREATOR_BUYABLE } from '@/lib/creatorCatalog';
import { manageUrl } from '@/lib/gumroadLinks';
import { PLANS } from '@/lib/plans';
import { AUTO_TRIAL_NOTE, clanTrialUsed, repeatNameClans } from '@/lib/planTrials';
import { planConverted, tierNameOf, trialTierIds } from '@/lib/planTrialRules';
import StartPlanTrial from './StartPlanTrial';

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');

/**
 * For staff, on one clan or creator space: every plan trial it has had (running / ended / converted /
 * taken back, and who started it), whether it has used its one trial, which checkout its owner's
 * "Subscribe" opens and why it may say "opens soon", its other Gumroad memberships, and the hand
 * grant ("Start plan trial").
 */
export default async function ClanTrialFacts({
  clan,
  canGrant,
}: {
  clan: { id: number; kind: string; plan: string; inGameName: string | null; trialEndsAt: string | null; gumroadSubscriptionId: string | null; gumroadRef: string | null };
  canGrant: boolean;
}) {
  const now = Date.now();
  const [trials, extras, used, repeat] = await Promise.all([
    db
      .select({ t: ownerTrials, by: users.displayName })
      .from(ownerTrials)
      .leftJoin(users, eq(users.id, ownerTrials.grantedBy))
      .where(and(eq(ownerTrials.kind, 'plan'), eq(ownerTrials.clanId, clan.id)))
      .orderBy(desc(ownerTrials.id)),
    db.select().from(clanExtraMemberships).where(eq(clanExtraMemberships.clanId, clan.id)).orderBy(desc(clanExtraMemberships.id)).limit(20),
    clanTrialUsed({ id: clan.id, trialEndsAt: clan.trialEndsAt, gumroadSubscriptionId: clan.gumroadSubscriptionId }),
    repeatNameClans([{ id: clan.id, kind: clan.kind, inGameName: clan.inGameName }]),
  ]);
  const creator = clan.kind === 'creator';
  const running = trials.find(({ t }) => !t.revokedAt && t.endsAt.getTime() > now)?.t ?? null;
  const statusOf = (t: typeof ownerTrials.$inferSelect) =>
    t.revokedAt ? 'taken back' : planConverted({ kind: clan.kind, plan: clan.plan, gumroadSubscriptionId: clan.gumroadSubscriptionId }, t.tier) ? 'converted' : t.endsAt.getTime() > now ? 'running' : 'ended, not converted';
  // What the owner's Subscribe button opens for each tier, by the one-trial rule.
  const tiers = creator ? CREATOR_BUYABLE : [PLANS.bronze, PLANS.silver, PLANS.gold];
  const buttons = tiers.map((tier) => {
    const b = creator ? creatorBuy(tier as (typeof CREATOR_BUYABLE)[number], clan.gumroadRef, 'monthly', used) : clanBuy(tier as typeof PLANS.bronze, clan.gumroadRef, 'monthly', used);
    const says =
      b.kind === 'trial' ? `Start free trial (Gumroad's ${b.trialDays}-day trial)${b.nowUrl ? ' + Skip trial, pay now' : ''}` : b.kind === 'subscribe' ? 'Subscribe, charged that day' : b.kind === 'soon' ? 'Subscribing opens soon' : 'no button (no checkout configured)';
    return { name: tier.name, says, why: b.kind === 'soon' ? soonReason(tier.gumroadUrlEnv) : null };
  });

  return (
    <div className="space-y-3 text-sm">
      <p className="text-text-muted">
        {used
          ? 'This one has used its trial (a trial from Anvil, a Gumroad trial, or a membership), so its Subscribe buttons only ever open the pay-now product.'
          : 'This one has never had a trial of any kind.'}
        {repeat.has(clan.id) && <span className="text-yellow-400"> Its in-game clan name already used a trial on a clan that was deleted. Nothing was taken back.</span>}
      </p>
      <ul className="space-y-1">
        {buttons.map((b) => (
          <li key={b.name}>
            <span className="text-gray-300">{b.name}:</span> <span className="text-text-muted">{b.says}</span>
            {b.why && <span className="block text-xs text-yellow-400">{b.why}</span>}
          </li>
        ))}
      </ul>

      {trials.length === 0 ? (
        <p className="text-text-muted">No plan trial on record.</p>
      ) : (
        <ul className="space-y-1">
          {trials.map(({ t, by }) => (
            <li key={t.id} className="flex flex-wrap gap-x-2 text-gray-300">
              <span className="text-gold">{tierNameOf(clan.kind, t.tier)}</span>
              <span className="text-text-muted">
                {day(t.startsAt)} to {day(t.endsAt)} · {statusOf(t)} · {t.grantedBy == null && t.note === AUTO_TRIAL_NOTE ? 'automatic, when it was created' : `started by ${by ?? 'a deleted login'}`}
                {t.note && t.note !== AUTO_TRIAL_NOTE && ` · “${t.note}”`}
                {t.remindRequestedAt && ` · asked for a reminder${t.remindedAt ? ' (sent)' : ''}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {extras.length > 0 && (
        <ul className="space-y-1">
          {extras.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-2">
              <span className={e.resolvedAt ? 'text-gray-500' : 'text-orange-300'}>
                {e.state === 'to_cancel' ? 'Older membership to cancel' : 'Waiting for its first charge'} · {tierNameOf(clan.kind, e.plan)}
              </span>
              <span className="text-text-muted">
                noted {day(e.notedAt)}
                {e.trialEndsAt && ` · first charge due ${day(e.trialEndsAt)}`}
                {e.reason === 'lower_tier' && ' · a lower or equal tier bought while the higher plan was live'}
                {e.cancelledAt && ` · cancelled ${day(e.cancelledAt)}, ends ${day(e.periodEndsAt)}`}
                {e.lastChargedAt && ` · charged again ${day(e.lastChargedAt)}`}
                {e.resolvedAt ? ` · closed ${day(e.resolvedAt)} (${e.resolution})` : ' · open'}
              </span>
              <a href={manageUrl(e.gumroadSubscriptionId)} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">
                {e.gumroadSubscriptionId}
              </a>
            </li>
          ))}
        </ul>
      )}

      {canGrant && (
        <StartPlanTrial
          clanId={clan.id}
          runningId={running?.id ?? null}
          tiers={trialTierIds(clan.kind).map((id) => ({ value: id, label: `${creator ? 'Creator ' : ''}${tierNameOf(clan.kind, id)}` }))}
        />
      )}
    </div>
  );
}
