// "Remind unpaid" for a competition's entry fees: a Discord DM to everyone who still owes one.
// The same rules as an event's reminder (lib/feeReminders): fees still pending only, one message
// per person, a 12-hour cooldown claimed under a lock so two clicks cannot both send.

import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, clanRoster, users, weeklyCompetitions, weeklyParticipants } from '@/db/schema';
import { getBotTokenOnly } from '@/lib/discord-roles';
import { sendDm, type RemindResult } from '@/lib/feeReminders';
import { FEE_REMIND_COOLDOWN_MS, cooldownRemainingMs, groupFeeRecipients, type FeeRecipient } from '@/lib/feeReminderText';
import { formatGp } from '@/lib/adminEventsFormat';
import { log } from '@/lib/logger';
import { absoluteUrl, clanCanonicalPath } from '@/lib/seo';

type Competition = typeof weeklyCompetitions.$inferSelect;
export const WEEKLY_FEE_REMIND_EVENT = 'weekly_fee_reminders_sent';
const sqlUtc = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

/** Who still owes, one recipient per person: whoever signed up, else the login behind the character. */
export async function unpaidWeeklyRecipients(comp: Competition): Promise<{ recipients: FeeRecipient[]; unreachable: number }> {
  const rows = await db
    .select({ enteredBy: weeklyParticipants.enteredByUserId, seat: weeklyParticipants.clanMemberId, amount: weeklyParticipants.feeAmount })
    .from(weeklyParticipants)
    .where(and(eq(weeklyParticipants.competitionId, comp.id), eq(weeklyParticipants.feeStatus, 'pending'), eq(weeklyParticipants.optedOut, false)));
  if (!rows.length) return { recipients: [], unreachable: 0 };
  // The login behind a character staff added: the person who plays the seat.
  const seatIds = rows.filter((r) => r.enteredBy == null && r.seat != null).map((r) => r.seat as number);
  const bySeat = new Map<number, number>();
  if (seatIds.length) {
    const seats = await db
      .select({ seat: clanRoster.id, userId: users.id })
      .from(clanRoster)
      .innerJoin(users, eq(users.playerId, clanRoster.playerId))
      .where(and(eq(clanRoster.clanId, comp.clanId), inArray(clanRoster.id, seatIds)));
    for (const s of seats) if (!bySeat.has(s.seat)) bySeat.set(s.seat, s.userId);
  }
  const userIds = [...new Set(rows.map((r) => r.enteredBy ?? (r.seat != null ? bySeat.get(r.seat) : undefined)).filter((n): n is number => n != null))];
  // clan-scope: global -- logins by the ids resolved from this competition's own entrants above.
  const logins = userIds.length ? await db.select({ id: users.id, discordId: users.discordId }).from(users).where(inArray(users.id, userIds)) : [];
  const discord = new Map(logins.map((u) => [u.id, u.discordId]));
  return groupFeeRecipients(
    rows.map((r) => {
      const userId = r.enteredBy ?? (r.seat != null ? bySeat.get(r.seat) ?? null : null);
      return { userId, discordId: userId != null ? discord.get(userId) ?? null : null, amount: r.amount ?? 0 };
    }),
  );
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lastWeeklyFeeReminder(comp: Competition, now: number, exec: typeof db | Tx = db): Promise<string | null> {
  const rows = await exec
    .select({ at: clanAuditLog.occurredAt, value: clanAuditLog.newValue })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.clanId, comp.clanId), eq(clanAuditLog.eventType, WEEKLY_FEE_REMIND_EVENT), gte(clanAuditLog.occurredAt, sqlUtc(now - FEE_REMIND_COOLDOWN_MS))))
    .orderBy(desc(clanAuditLog.occurredAt));
  for (const r of rows) {
    try {
      if ((JSON.parse(r.value ?? '{}') as { competitionId?: number }).competitionId === comp.id) return r.at;
    } catch {
      /* a malformed row is not a reminder */
    }
  }
  return null;
}

/** The DM: which competition, how much, and where to look. */
export function weeklyFeeReminderEmbed(p: { clanName: string; title: string; amount: number; fees: number; url: string }): Record<string, unknown> {
  const owed = p.fees > 1 ? `${formatGp(p.amount)} gp (for ${p.fees} characters)` : `${formatGp(p.amount)} gp`;
  return {
    title: `Entry fee for ${p.title}`,
    url: p.url,
    color: 0xf59e0b,
    description: [
      `Hi! **${p.clanName}** hasn’t got your entry fee for **${p.title}** yet: **${owed}**.`,
      'Trade it in-game to one of the clan’s staff. They mark it paid on the competition.',
      `[Open the competition](${p.url})`,
      'Already paid? Ignore this, staff will catch up.',
    ].join('\n\n'),
  };
}

export async function remindWeeklyFees(p: {
  clan: { id: number; name: string; slug: string; kind?: string | null };
  comp: Competition;
  actorUserId: number;
  now?: number;
  deps?: { botToken?: (clanId: number) => Promise<string | null>; send?: typeof sendDm };
}): Promise<RemindResult> {
  const now = p.now ?? Date.now();
  const botToken = p.deps?.botToken ?? (async (id: number) => (await getBotTokenOnly(id).catch(() => null))?.token ?? null);
  const send = p.deps?.send ?? sendDm;

  const early = cooldownRemainingMs(await lastWeeklyFeeReminder(p.comp, now), now);
  if (early > 0) return { ok: false, status: 429, error: 'This competition was reminded recently.', waitMs: early };
  const { recipients, unreachable } = await unpaidWeeklyRecipients(p.comp);
  if (recipients.length === 0) {
    return { ok: false, status: 409, error: unreachable ? 'Nobody who owes has a linked Discord account to message.' : 'Nobody in this competition still owes a fee.' };
  }
  const token = await botToken(p.clan.id);
  if (!token) return { ok: false, status: 409, error: 'Connect your Discord bot first (Settings → Discord).' };

  const claim = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('weekly-fee-reminder'), ${p.comp.id})`);
    const waitMs = cooldownRemainingMs(await lastWeeklyFeeReminder(p.comp, now, tx), now);
    if (waitMs > 0) return { waitMs } as const;
    const [stamp] = await tx
      .insert(clanAuditLog)
      .values({
        clanId: p.clan.id,
        eventType: WEEKLY_FEE_REMIND_EVENT,
        actorUserId: p.actorUserId > 0 ? p.actorUserId : null,
        occurredAt: sqlUtc(now),
        newValue: JSON.stringify({ competitionId: p.comp.id, pending: recipients.length }),
        notes: `Started reminding ${recipients.length} unpaid on ${p.comp.title}.`,
      })
      .returning({ id: clanAuditLog.id });
    return { stampId: stamp.id } as const;
  });
  if ('waitMs' in claim) return { ok: false, status: 429, error: 'This competition was reminded recently.', waitMs: claim.waitMs };

  const url = absoluteUrl(clanCanonicalPath(p.clan, `/weekly/${p.comp.id}`));
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    const embed = weeklyFeeReminderEmbed({ clanName: p.clan.name, title: p.comp.title, amount: r.amount, fees: r.fees, url });
    if (await send(token, r.discordId, { embeds: [embed] }).catch(() => false)) sent++;
    else failed++;
  }
  await db
    .update(clanAuditLog)
    .set({
      newValue: JSON.stringify({ competitionId: p.comp.id, sent, failed, unreachable }),
      notes: `Reminded ${sent} unpaid on ${p.comp.title} by Discord DM${failed ? ` (${failed} could not be reached)` : ''}.`,
    })
    .where(eq(clanAuditLog.id, claim.stampId));
  log.info('weekly-fee-reminders.sent', { clanId: p.clan.id, competitionId: p.comp.id, sent, failed, unreachable });
  return { ok: true, sent, failed, unreachable };
}
