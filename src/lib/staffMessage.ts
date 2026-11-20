import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clans, clanStaff, users } from '@/db/schema';
import { renderEmail } from '@/lib/emailTemplates';
import { escapeHtml, isMailConfigured, sendMail } from '@/lib/mailer';
import { SITE } from '@/lib/site';
import { discordDm } from '@/lib/ownershipClaims';
import { clanCanonicalPath } from '@/lib/seo';
import { STAFF_MESSAGE_MAX } from '@/lib/staffMessageText';

// A note from Anvil's staff to a clan's owner, as a Discord DM or (for the owner Discord cannot
// reach: closed DMs, no shared server) an email.
//
// Written and sent by a person: staff open a draft, edit it, and press Send. Nothing here sends by
// itself. It goes through Anvil's own bot (or the clan's, when that is the one sharing a server with
// the owner), and every send is a line in the clan's log with who sent it and what it said.

export type StaffMessageResult = { ok: true; via: StaffMessageVia } | { ok: false; error: string };
export type StaffMessageVia = 'discord' | 'email';

/**
 * Where an emailed reply goes: STAFF_MAIL_REPLY_TO when set, else the sender itself. Without it a
 * reply lands on MAIL_FROM, which is usually a no-reply address nobody reads.
 */
function replyTo(): string | undefined {
  const v = process.env.STAFF_MAIL_REPLY_TO?.trim();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined;
}

/** Can staff email owners from this deployment, and where do replies go? For the dialog. */
export function staffMailStatus(): { on: boolean; replies: boolean } {
  return { on: isMailConfigured(), replies: !!replyTo() };
}

export async function messageClanOwner(clanId: number, actorUserId: number, text: string, via: StaffMessageVia = 'discord'): Promise<StaffMessageResult> {
  const body = text.trim();
  if (!body) return { ok: false, error: 'Write the message first.' };
  if (body.length > STAFF_MESSAGE_MAX) return { ok: false, error: `Keep it under ${STAFF_MESSAGE_MAX.toLocaleString()} characters.` };
  // clan-scope: global -- a platform operator writing to one clan's owner, by that clan's id.
  const [clan] = await db.select({ id: clans.id, name: clans.name, slug: clans.slug, kind: clans.kind, contactEmail: clans.contactEmail }).from(clans).where(eq(clans.id, clanId));
  if (!clan) return { ok: false, error: 'No such clan.' };
  const [owner] = await db
    .select({ userId: clanStaff.userId, email: users.email })
    .from(clanStaff)
    .leftJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.role, 'owner')));
  if (!owner) return { ok: false, error: 'This clan has no owner to write to.' };

  if (via === 'email') {
    // The address Discord gave us at sign-in, else the clan's billing contact.
    const to = [owner.email, clan.contactEmail].map((e) => e?.trim() ?? '').find((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (!isMailConfigured()) return { ok: false, error: 'Email is not set up on this deployment.' };
    if (!to) return { ok: false, error: 'There is no email address on record for this owner.' };
    const subject = `A message from Anvil about ${clan.name}`;
    const { html, text: plain } = renderEmail({
      preheader: escapeHtml(subject),
      heading: escapeHtml(subject),
      lines: body.split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, '<br>')),
      cta: { label: `Open ${clan.name}`, url: `${SITE.baseUrl}${clanCanonicalPath(clan)}` },
      footnote: replyTo() ? 'Reply to this email and it reaches the Anvil team.' : 'This was sent by a person on the Anvil team.',
    });
    const sent = await sendMail({ to, subject, text: plain, html, replyTo: replyTo() }).catch(() => false);
    if (!sent) return { ok: false, error: 'The email could not be sent. Try Discord, or try again in a minute.' };
    await db
      .insert(clanAuditLog)
      .values({ clanId, eventType: 'staff_message_owner', actorUserId, newValue: JSON.stringify({ to: owner.userId, via: 'email' }), notes: body })
      .catch(() => {});
    return { ok: true, via: 'email' };
  }

  const sent = await discordDm(owner.userId, { title: `A message from Anvil about ${clan.name}`, description: body }, clanCanonicalPath(clan)).catch(() => false);
  if (!sent) return { ok: false, error: 'Discord would not deliver it: the owner shares no server with the bot, or has DMs closed. Send it by email instead, or their Discord profile is on the clan row.' };
  await db
    .insert(clanAuditLog)
    .values({ clanId, eventType: 'staff_message_owner', actorUserId, newValue: JSON.stringify({ to: owner.userId, via: 'discord' }), notes: body })
    .catch(() => {});
  return { ok: true, via: 'discord' };
}

export interface LastOwnerMessage {
  /** UTC `YYYY-MM-DD HH:MM:SS`, as clan_audit_log stores it. */
  at: string;
  via: StaffMessageVia;
}

/** The last staff note to each of these clans' owners, from the clans' logs, so "sent" survives a reload. */
export async function lastOwnerMessages(clanIds: number[]): Promise<Record<number, LastOwnerMessage>> {
  if (clanIds.length === 0) return {};
  // clan-scope: global -- a platform operator's own sends, read back for the clans on one staff page.
  const rows = await db
    .select({ clanId: clanAuditLog.clanId, at: clanAuditLog.occurredAt, value: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(and(inArray(clanAuditLog.clanId, clanIds), eq(clanAuditLog.eventType, 'staff_message_owner')))
    .orderBy(desc(clanAuditLog.id))
    .catch(() => []);
  const out: Record<number, LastOwnerMessage> = {};
  for (const r of rows) {
    if (r.clanId == null || out[r.clanId]) continue;
    let via: StaffMessageVia = 'discord';
    try {
      via = (JSON.parse(r.value ?? '{}') as { via?: string }).via === 'email' ? 'email' : 'discord';
    } catch {
      /* an older row: a DM */
    }
    out[r.clanId] = { at: String(r.at), via };
  }
  return out;
}
