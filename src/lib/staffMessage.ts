import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans, clanStaff } from '@/db/schema';
import { discordDm } from '@/lib/ownershipClaims';
import { clanCanonicalPath } from '@/lib/seo';
import { STAFF_MESSAGE_MAX } from '@/lib/staffMessageText';

// A note from Anvil's staff to a clan's owner, as a Discord DM.
//
// Written and sent by a person: staff open a draft, edit it, and press Send. Nothing here sends by
// itself. It goes through Anvil's own bot (or the clan's, when that is the one sharing a server with
// the owner), and every send is a line in the clan's log with who sent it and what it said.

export type StaffMessageResult = { ok: true } | { ok: false; error: string };

export async function messageClanOwner(clanId: number, actorUserId: number, text: string): Promise<StaffMessageResult> {
  const body = text.trim();
  if (!body) return { ok: false, error: 'Write the message first.' };
  if (body.length > STAFF_MESSAGE_MAX) return { ok: false, error: `Keep it under ${STAFF_MESSAGE_MAX.toLocaleString()} characters.` };
  // clan-scope: global -- a platform operator writing to one clan's owner, by that clan's id.
  const [clan] = await db.select({ id: clans.id, name: clans.name, slug: clans.slug, kind: clans.kind }).from(clans).where(eq(clans.id, clanId));
  if (!clan) return { ok: false, error: 'No such clan.' };
  const [owner] = await db.select({ userId: clanStaff.userId }).from(clanStaff).where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.role, 'owner')));
  if (!owner) return { ok: false, error: 'This clan has no owner to write to.' };
  const sent = await discordDm(owner.userId, { title: `A message from Anvil about ${clan.name}`, description: body }, clanCanonicalPath(clan)).catch(() => false);
  if (!sent) return { ok: false, error: 'Discord would not deliver it: the owner shares no server with the bot, or has DMs closed. Their Discord profile and email are on the clan row.' };
  await db
    .insert(clanAuditLog)
    .values({ clanId, eventType: 'staff_message_owner', actorUserId, newValue: JSON.stringify({ to: owner.userId }), notes: body })
    .catch(() => {});
  return { ok: true };
}
