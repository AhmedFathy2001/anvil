import { eq, inArray } from 'drizzle-orm';

import ClanLink from '@/components/ClanLink';
import { db } from '@/db';
import { supporterSubscriptions, users } from '@/db/schema';
import { listOpenExtras } from '@/lib/extraMemberships';
import { manageUrl } from '@/lib/gumroadLinks';
import { tierNameOf } from '@/lib/planTrialRules';
import { membershipsToCancel } from '@/lib/supporterDuplicates';
import { HELD_STATUS, SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

const day = (d: Date | string | null) => {
  const ms = d instanceof Date ? d.getTime() : d ? Date.parse(d.includes('T') ? d : `${d.replace(' ', 'T')}Z`) : NaN;
  return Number.isNaN(ms) ? '—' : new Date(ms).toISOString().slice(0, 10);
};

/**
 * Open items after an upgrade purchase or a second trial (lib/extraMemberships, lib/supporterDuplicates):
 *   - an OLDER membership still charging beside the new one, until Gumroad reports it cancelled or ended
 *     (the owner has the same notice and the link; the site cannot cancel on Gumroad);
 *   - a membership Gumroad opened with a free trial for someone who had already had theirs, which
 *     starts at its first real charge.
 * Each line closes by itself when the webhook hears the cancellation, end or charge.
 */
export default async function OpenMemberships() {
  const [extras, paid] = await Promise.all([
    listOpenExtras(),
    // clan-scope: global -- billing is the platform's; every person paying for Supporter.
    db
      .select({
        id: supporterSubscriptions.id,
        userId: supporterSubscriptions.userId,
        tier: supporterSubscriptions.tier,
        status: supporterSubscriptions.status,
        startedAt: supporterSubscriptions.startedAt,
        currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
        gumroadSubscriptionId: supporterSubscriptions.gumroadSubscriptionId,
        name: users.displayName,
      })
      .from(supporterSubscriptions)
      .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
      .where(inArray(supporterSubscriptions.status, ['active', HELD_STATUS])),
  ]);
  const byUser = new Map<number, typeof paid>();
  for (const r of paid) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  const people = [...byUser.values()].flatMap((rows) => membershipsToCancel(rows).map((m) => ({ ...m, name: rows[0].name, userId: rows[0].userId })));
  const held = paid.filter((r) => r.status === HELD_STATUS);
  if (extras.length === 0 && people.length === 0 && held.length === 0) return null;

  return (
    <section className="mt-5 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-5 w-1 bg-gold" />
        <h2 className="text-lg font-semibold">Memberships to follow up</h2>
        <span className="text-xs text-gray-400">{extras.length + people.length + held.length} open</span>
      </div>
      <p className="mb-3 text-xs text-gray-400">
        Moving tier is a new Gumroad purchase, and the old membership keeps charging until it is cancelled on Gumroad. The owner
        sees the same notice with the link. A line closes when Gumroad reports the cancellation or end.
      </p>
      <ul className="space-y-1.5 text-sm">
        {extras.map((e) => (
          <li key={`c${e.id}`} className="flex flex-wrap items-baseline gap-x-2">
            <ClanLink href={`/staff/clans/${e.clanId}`} className="font-medium text-gold hover:underline">
              {e.clanName}
            </ClanLink>
            {e.state === 'to_cancel' ? (
              <span className="text-orange-200">
                has two memberships: now on {tierNameOf(e.kind, e.currentPlan)}, and the older {tierNameOf(e.kind, e.plan)} one is still to cancel
                {e.lastChargedAt && <b> · charged again {day(e.lastChargedAt)}</b>}
              </span>
            ) : (
              <span className="text-gray-300">
                bought {tierNameOf(e.kind, e.plan)} with a Gumroad trial after already having one: it starts at its first charge{e.trialEndsAt && `, due ${day(e.trialEndsAt)}`}
              </span>
            )}
            <span className="text-xs text-gray-500">since {day(e.notedAt)}</span>
            <a href={manageUrl(e.subscriptionId)} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:underline">
              {e.subscriptionId}
            </a>
          </li>
        ))}
        {people.map((m) => (
          <li key={`p${m.rowId}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-gold">{m.name ?? `login ${m.userId}`}</span>
            <span className="text-orange-200">has two Supporter memberships renewing: the older {m.tierName} one is still to cancel</span>
            <a href={manageUrl(m.subscriptionId)} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-400 hover:underline">
              {m.subscriptionId}
            </a>
          </li>
        ))}
        {held.map((r) => (
          <li key={`h${r.id}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-gold">{r.name ?? `login ${r.userId}`}</span>
            <span className="text-gray-300">
              bought {SUPPORTER_TIERS[r.tier as SupporterTierId]?.name ?? r.tier} with a Gumroad trial after already having one: it starts at its first charge, due {day(r.currentPeriodEnd)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
