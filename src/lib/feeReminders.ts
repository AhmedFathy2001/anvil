// "Remind unpaid": DM everyone who still owes an entry fee on one event. The rules (grouping, the
// cooldown, the message) are pure and live in lib/feeReminderText; this is the database and Discord.
//
// WHO COUNTS AS UNPAID: fees still `pending` on a live sign-up. `reported` is excluded on purpose —
// that person already said who they paid, and a "you haven't paid" DM to them is wrong and rude.
// `disputed` is a staff problem, not the player's to fix from a DM.
//
// THE STAMP GOES IN FIRST. The cooldown row is written before any DM is sent and filled in with the
// outcome after, so two treasurers pressing the button at once can't both get through the check
// and message everyone twice.

import { and, desc, eq, gte, notInArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, eventSignups, signupFees, users } from '@/db/schema';
import { discordRest, getBotTokenOnly } from '@/lib/discord-roles';
import { log } from '@/lib/logger';
import {
  FEE_REMIND_COOLDOWN_MS,
  FEE_REMIND_EVENT,
  cooldownRemainingMs,
  feeReminderEmbed,
  groupFeeRecipients,
  type FeeRecipient,
} from '@/lib/feeReminderText';
import { absoluteUrl, clanCanonicalPath } from '@/lib/seo';

/** The pending fees on one event, one recipient per person. Clan-scoped by the caller's event. */
export async function unpaidFeeRecipients(eventId: number): Promise<{ recipients: FeeRecipient[]; unreachable: number }> {
  // clan-scope: this clan -- eventId was resolved through eventForRequest by the caller.
  const rows = await db
    .select({ userId: eventSignups.userId, discordId: users.discordId, amount: signupFees.amount })
    .from(signupFees)
    .innerJoin(eventSignups, eq(signupFees.signupId, eventSignups.id))
    .leftJoin(users, eq(eventSignups.userId, users.id))
    .where(
      and(
        eq(eventSignups.eventId, eventId),
        eq(signupFees.status, 'pending'),
        notInArray(eventSignups.status, ['withdrawn', 'rejected']),
      ),
    );
  return groupFeeRecipients(rows);
}

/** Format a timestamp the way the audit table's SQL default does, so string comparison works. */
function sqlUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** When this event was last reminded (within the cooldown window), or null. */
export async function lastFeeReminder(clanId: number, eventId: number, now: number): Promise<string | null> {
  const rows = await db
    .select({ at: clanAuditLog.occurredAt, value: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(
      and(
        eq(clanAuditLog.clanId, clanId),
        eq(clanAuditLog.eventType, FEE_REMIND_EVENT),
        gte(clanAuditLog.occurredAt, sqlUtc(now - FEE_REMIND_COOLDOWN_MS)),
      ),
    )
    .orderBy(desc(clanAuditLog.occurredAt));
  for (const r of rows) {
    try {
      if ((JSON.parse(r.value ?? '{}') as { eventId?: number }).eventId === eventId) return r.at;
    } catch {
      /* a malformed row is not a reminder */
    }
  }
  return null;
}

async function sendDm(botToken: string, discordId: string, body: Record<string, unknown>): Promise<boolean> {
  const dm = await discordRest(botToken, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!dm.ok) return false;
  const channel = (await dm.json()) as { id: string };
  const res = await discordRest(botToken, `/channels/${channel.id}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.ok;
}

export type RemindResult =
  | { ok: true; sent: number; failed: number; unreachable: number }
  | { ok: false; status: number; error: string; waitMs?: number };

export async function remindUnpaidFees(p: {
  clan: { id: number; name: string; slug: string };
  event: { id: number; name: string };
  actorUserId: number;
  now?: number;
}): Promise<RemindResult> {
  const now = p.now ?? Date.now();
  const waitMs = cooldownRemainingMs(await lastFeeReminder(p.clan.id, p.event.id, now), now);
  if (waitMs > 0) {
    return { ok: false, status: 429, error: 'This event was reminded recently.', waitMs };
  }

  const { recipients, unreachable } = await unpaidFeeRecipients(p.event.id);
  if (recipients.length === 0) {
    return {
      ok: false,
      status: 409,
      error: unreachable
        ? 'Nobody unpaid on this event has a linked Discord account to message.'
        : 'Nobody on this event still owes a fee.',
    };
  }

  const bot = await getBotTokenOnly(p.clan.id).catch(() => null);
  if (!bot) {
    return { ok: false, status: 409, error: 'Connect your Discord bot first (Settings → Discord).' };
  }

  // The stamp, before anything is sent (see the header).
  const [stamp] = await db
    .insert(clanAuditLog)
    .values({
      clanId: p.clan.id,
      eventType: FEE_REMIND_EVENT,
      actorUserId: p.actorUserId > 0 ? p.actorUserId : null,
      newValue: JSON.stringify({ eventId: p.event.id, pending: recipients.length }),
      notes: `Started reminding ${recipients.length} unpaid on ${p.event.name}.`,
    })
    .returning({ id: clanAuditLog.id });

  const url = absoluteUrl(clanCanonicalPath(p.clan.slug, `/events/${p.event.id}/signup`));
  let sent = 0;
  let failed = 0;
  // One at a time: Discord rate-limits DM channel creation, and a clan's unpaid list is short.
  for (const r of recipients) {
    const embed = feeReminderEmbed({ clanName: p.clan.name, eventName: p.event.name, amount: r.amount, fees: r.fees, url });
    if (await sendDm(bot.token, r.discordId, { embeds: [embed] }).catch(() => false)) sent++;
    else failed++;
  }

  await db
    .update(clanAuditLog)
    .set({
      newValue: JSON.stringify({ eventId: p.event.id, sent, failed, unreachable }),
      notes: `Reminded ${sent} unpaid on ${p.event.name} by Discord DM${failed ? ` (${failed} could not be reached)` : ''}.`,
    })
    .where(eq(clanAuditLog.id, stamp.id));
  log.info('fee-reminders.sent', { clanId: p.clan.id, eventId: p.event.id, sent, failed, unreachable });

  return { ok: true, sent, failed, unreachable };
}
