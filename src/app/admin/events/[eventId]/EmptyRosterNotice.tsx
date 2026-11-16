import { and, count, eq, isNull } from 'drizzle-orm';

import ClanLink from '@/components/ClanLink';
import { db } from '@/db';
import { clanMemberships, clans } from '@/db/schema';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { guestPolicyOf } from '@/lib/guestAdmission';

/**
 * A brand-new clan has no roster yet (the owner alone), and a sign-up from anyone else is a request
 * to a clan that needs a yes first. Said plainly, with the setting that already decides it, instead
 * of the owner finding out when their first player sits waiting. Admission rules are NOT changed
 * here: this only names them.
 */
export default async function EmptyRosterNotice({ clanId, eventId, entry }: { clanId: number; eventId: number; entry: string }) {
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId), columns: { kind: true } });
  if (isCreatorSpace(clan)) return null;
  const [mc] = await db
    .select({ c: count() })
    .from(clanMemberships)
    // clan-scope: this clan's own live member seats.
    .where(and(eq(clanMemberships.clanId, clanId), isNull(clanMemberships.leftAt), eq(clanMemberships.kind, 'member')));
  if ((mc?.c ?? 0) > 1) return null;
  const policy = await guestPolicyOf(clanId);
  const waiting = policy === 'approval' || entry === 'approval';
  if (!waiting) return null;
  return (
    <div className="mb-4 rounded-xl border border-gold/30 bg-gold/[0.06] p-4 text-sm">
      <div className="font-semibold text-gold">Players who sign up will wait for your yes</div>
      <p className="mt-1 text-text-muted">
        Your member list is empty, so everyone who signs up counts as a guest
        {entry === 'approval' ? ' and this event asks you about every player' : ' and your clan asks before letting guests in'}.
        You can answer them under Roster, or let guests in without approval.
      </p>
      <div className="mt-2 flex flex-wrap gap-4">
        {policy === 'approval' && (
          <ClanLink href="/admin/people/access" className="font-semibold text-gold hover:underline">
            Let anyone in as a guest &rarr;
          </ClanLink>
        )}
        {entry === 'approval' && (
          <ClanLink href={`/admin/events/${eventId}/settings/access`} className="font-semibold text-gold hover:underline">
            Change who this event asks about &rarr;
          </ClanLink>
        )}
        <ClanLink href="/admin/people" className="text-text-muted hover:text-gold">
          Open the roster
        </ClanLink>
      </div>
    </div>
  );
}
