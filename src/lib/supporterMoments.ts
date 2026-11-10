// Feed and Discord posts for the slow-moving Supporter and streak news: a tenure step reached, a
// weekly streak milestone, a gift bought for a clanmate. They are ordinary 'milestone' moments (sub
// 'tenure' | 'streak' | 'gift', lib/milestoneMoments), so the clan feed, the plugin's Feed tab and
// reactions show them like any other. Each is deduped by its own key, so the daily sweep can run
// as often as it likes.
//
// Privacy, the same as the names elsewhere: only a character that already wears its flair publicly
// (shared + verified) is named, only on a MEMBER seat (a guest's news belongs to their own clan), and
// a person who turned off "announce me" (users.announce_supporter) gets no tenure or gift posts.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, clans, moments, supporterSubscriptions, users } from '@/db/schema';
import { weekOf } from '@/lib/activityStreak';
import { clanStreaks } from '@/lib/activityStreaks';
import { isDiscordWebhookTarget } from '@/lib/discordWebhookUrl';
import { notLabClan } from '@/lib/lab';
import { log } from '@/lib/logger';
import { MILESTONE_KIND } from '@/lib/milestoneMoments';
import { getPlatformSetting, isPreview } from '@/lib/platformSettings';
import { apexOrigin } from '@/lib/seo';
import { flairCharacterWhere, supporterState } from '@/lib/supporter';
import { TENURE_LADDER, paidRunStart, tenureLabel, type TenureStepId } from '@/lib/supporterTiers';

export type SupporterMomentSub = 'tenure' | 'streak' | 'gift';

/** One 'milestone' moment on a member seat; false when its key was already used. */
async function recordText(seat: { id: number; rsn: string }, sub: SupporterMomentSub, text: string, quantity: number, key: string): Promise<boolean> {
  const [row] = await db
    .insert(moments)
    .values({
      clanMemberId: seat.id,
      rsn: seat.rsn,
      kind: MILESTONE_KIND,
      weeklyCompetitionId: null,
      eventId: null,
      teamId: null,
      itemId: null,
      itemName: text.slice(0, 120),
      quantity,
      valueGp: null,
      source: null,
      sourceKind: sub,
      kc: null,
      rarityDenominator: null,
      tier: null,
      occurredAt: new Date().toISOString(),
      dedupKey: key,
    })
    .onConflictDoNothing()
    .returning({ id: moments.id });
  return !!row;
}

/** A person's public member seats: the characters that wear their flair, on clans they're a member of. */
async function publicSeatsOf(playerIds: number[]): Promise<Map<number, { id: number; rsn: string; clanId: number }[]>> {
  const out = new Map<number, { id: number; rsn: string; clanId: number }[]>();
  if (playerIds.length === 0) return out;
  const rows = await db
    .select({ playerId: accounts.playerId, seatId: clanMemberships.id, rsn: accounts.rsn, clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
    .innerJoin(clans, eq(clans.id, clanMemberships.clanId))
    .where(and(inArray(accounts.playerId, playerIds), eq(clanMemberships.kind, 'member'), flairCharacterWhere(), notLabClan(clanMemberships.clanId)));
  for (const r of rows) {
    if (r.playerId == null) continue;
    out.set(r.playerId, [...(out.get(r.playerId) ?? []), { id: r.seatId, rsn: r.rsn, clanId: r.clanId }]);
  }
  return out;
}

/** Post to the Anvil Discord's supporters channel (the same one "new supporter" posts go to). */
async function postAnvilSupporters(embed: Record<string, unknown>): Promise<void> {
  if (isPreview()) return;
  const hook = await getPlatformSetting('anvil_discord_supporters_webhook');
  if (!hook || !isDiscordWebhookTarget(hook)) return;
  await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ embeds: [embed] }) }).catch(() => {});
}

const TENURE_COLOR = 0xe0aa1e;
/** How recent a tenure step must be to post it. */
const FRESH_MS = 7 * 86_400_000;

/** Every Supporter who reached a tenure step past Apprentice and hasn't been posted for it. */
async function sweepTenure(): Promise<number> {
  const rows = await db
    .select({
      playerId: users.playerId,
      announce: users.announceSupporter,
      userId: supporterSubscriptions.userId,
      tier: supporterSubscriptions.tier,
      status: supporterSubscriptions.status,
      currentPeriodEnd: supporterSubscriptions.currentPeriodEnd,
      startedAt: supporterSubscriptions.startedAt,
      tenureStartedAt: supporterSubscriptions.tenureStartedAt,
      endedAt: supporterSubscriptions.endedAt,
      recurrence: supporterSubscriptions.recurrence,
    })
    .from(supporterSubscriptions)
    .innerJoin(users, eq(users.id, supporterSubscriptions.userId))
    .where(isNotNull(users.playerId));
  const byPerson = new Map<number, typeof rows>();
  for (const r of rows) byPerson.set(r.playerId!, [...(byPerson.get(r.playerId!) ?? []), r]);
  const reached = new Map<number, { step: TenureStepId; months: number; tierName: string }>();
  for (const [pid, list] of byPerson) {
    if (list.some((r) => !r.announce)) continue;
    const s = supporterState(list);
    if (!s || s.tenure.id === 'apprentice') continue;
    // Only news: a step reached in the last week. Someone who got there long ago (or before this
    // shipped) isn't announced as if it just happened.
    const run = paidRunStart(list);
    if (run == null) continue;
    const at = new Date(run);
    at.setUTCMonth(at.getUTCMonth() + s.tenure.months);
    if (Date.now() - at.getTime() > FRESH_MS) continue;
    reached.set(pid, { step: s.tenure.id, months: s.tenureMonths, tierName: s.tier.name });
  }
  const seats = await publicSeatsOf([...reached.keys()]);
  let posted = 0;
  for (const [pid, r] of reached) {
    const step = TENURE_LADDER.find((t) => t.id === r.step)!;
    const text = `reached ${step.name}: ${tenureLabel(step.months)} supporting Anvil`;
    let any = false;
    for (const seat of seats.get(pid) ?? []) if (await recordText(seat, 'tenure', text, step.months, `tenure:${pid}:${step.id}:${seat.id}`)) any = true;
    if (any) {
      posted++;
      const name = seats.get(pid)?.[0]?.rsn;
      if (name) {
        await postAnvilSupporters({
          title: `${step.name}: ${tenureLabel(step.months)}`,
          description: `**${name}** has supported Anvil for ${tenureLabel(step.months)} without a break, as an Anvil ${r.tierName}. Thank you!`,
          color: TENURE_COLOR,
          url: `${apexOrigin()}/supporter`,
        });
      }
    }
  }
  return posted;
}

/** Streak milestones landed this week, per clan (members only, the clan's own feed). */
async function sweepStreaks(): Promise<number> {
  const live = await db.select({ id: clans.id }).from(clans).where(and(eq(clans.kind, 'clan'), eq(clans.status, 'active'), notLabClan(clans.id)));
  const week = weekOf(new Date().toISOString().slice(0, 10));
  let posted = 0;
  for (const c of live) {
    const h = await clanStreaks(c.id).catch(() => null);
    if (!h || h.milestones.length === 0) continue;
    const names = h.milestones.map((m) => m.rsn);
    const seatRows = await db
      .select({ id: clanMemberships.id, rsn: accounts.rsn })
      .from(clanMemberships)
      .innerJoin(accounts, eq(accounts.id, clanMemberships.accountId))
      .where(and(eq(clanMemberships.clanId, c.id), eq(clanMemberships.kind, 'member'), inArray(accounts.rsn, names)));
    const seatOf = new Map(seatRows.map((s) => [s.rsn, s]));
    for (const m of h.milestones) {
      const seat = seatOf.get(m.rsn);
      if (!seat) continue;
      if (await recordText(seat, 'streak', `reached ${m.name}: a ${m.weeks}-week activity streak`, m.weeks, `streak:${seat.id}:${m.weeks}:${week}`)) posted++;
    }
  }
  return posted;
}

/** Daily (the billing cron): tenure steps and streak milestones. Never throws. */
export async function sweepSupporterMoments(): Promise<{ tenure: number; streaks: number }> {
  const tenure = await sweepTenure().catch((err) => (log.warn('supporter-moments.tenure-failed', {}, err), 0));
  const streaks = await sweepStreaks().catch((err) => (log.warn('supporter-moments.streaks-failed', {}, err), 0));
  return { tenure, streaks };
}

/**
 * A gift just landed: "X gifted Y 3 months of Supporter" in every clan where both are members, and
 * in the Anvil Discord. Skipped for a buyer who turned off "announce me". Never throws.
 */
export async function announceGift(saleId: string, buyerUserId: number, recipientUserId: number, months: number, tierName: string): Promise<void> {
  try {
    const [buyer, recipient] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, buyerUserId), columns: { playerId: true, announceSupporter: true } }),
      db.query.users.findFirst({ where: eq(users.id, recipientUserId), columns: { playerId: true } }),
    ]);
    if (!buyer?.playerId || !recipient?.playerId || !buyer.announceSupporter) return;
    const seats = await publicSeatsOf([buyer.playerId, recipient.playerId]);
    const theirs = seats.get(recipient.playerId) ?? [];
    const length = months === 12 ? 'a year' : `${months} month${months === 1 ? '' : 's'}`;
    for (const mine of seats.get(buyer.playerId) ?? []) {
      const them = theirs.find((s) => s.clanId === mine.clanId);
      if (!them) continue;
      await recordText(mine, 'gift', `gifted ${them.rsn} ${length} of Anvil ${tierName}`, months, `gift:${saleId}:${mine.id}`);
    }
    const from = seats.get(buyer.playerId)?.[0]?.rsn;
    const to = theirs[0]?.rsn;
    if (from && to) {
      await postAnvilSupporters({
        title: 'A gift',
        description: `**${from}** gifted **${to}** ${length} of Anvil ${tierName}. What a legend.`,
        color: 0xff7ab8,
        url: `${apexOrigin()}/supporter/gift`,
      });
    }
  } catch (err) {
    log.warn('supporter-moments.gift-failed', {}, err);
  }
}
