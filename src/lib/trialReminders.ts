// The trial reminder: one notice to everyone on an Anvil trial, three days before it ends.
//
// Anvil's trials are its own (owner_trials): no card is taken, so nothing tells the person the end is
// near unless we do. The daily billing cron calls sendTrialReminders, which, for each trial that is
// within TRIAL_REMIND_DAYS of its end (or, when a run was missed, already past it), puts ONE notice in
// the existing Anvil inbox (lib/notices) — for a plan trial the clan's owners and admins, for a
// Supporter trial the person — and sends the same by Discord DM only to people who already said yes to
// DMs (the notice's own `byDm` path). No new channel, no email. Stamped so it is sent once; a trial
// that was revoked, or that became a paid plan (converted_at), is left alone.
//
// It used to be opt-in and sent AFTER the end ("Remind me when the trial ends"): by then the plan had
// already dropped, which is the moment a reminder is least use.

import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, ownerTrials } from '@/db/schema';
import { apexDomain } from '@/lib/apexHost';
import { clanBasePath } from '@/lib/clanScopedPaths';
import { createNotice } from '@/lib/notices';
import { tierNameOf } from '@/lib/planTrialRules';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

/** How long before a trial ends its reminder goes out. */
export const TRIAL_REMIND_DAYS = 3;
const DAY_MS = 86_400_000;

/**
 * When a trial's reminder is due: TRIAL_REMIND_DAYS before the end, but never in the first half of
 * the trial (a three-day trial is reminded at a day and a half, not the moment it starts).
 */
export function trialReminderDueAt(startsAt: Date, endsAt: Date): number {
  const end = endsAt.getTime();
  const lead = Math.min(TRIAL_REMIND_DAYS * DAY_MS, (end - startsAt.getTime()) / 2);
  return end - Math.max(0, lead);
}

/** "in 3 days", "tomorrow", "today": how far off an end is, in whole days. */
export function endsInWords(endsAt: Date, now: number): string {
  const days = Math.ceil((endsAt.getTime() - now) / DAY_MS);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export async function sendTrialReminders(now = Date.now()): Promise<{ sent: number }> {
  // Anything ending within the reminder window; the exact due moment is checked per row below.
  const candidates = await db
    .select()
    .from(ownerTrials)
    .where(
      and(
        isNull(ownerTrials.remindedAt),
        isNull(ownerTrials.revokedAt),
        isNull(ownerTrials.convertedAt),
        sql`${ownerTrials.endsAt} <= ${new Date(now + TRIAL_REMIND_DAYS * DAY_MS).toISOString()}`,
      ),
    )
    .limit(200);
  const due = candidates.filter((t) => trialReminderDueAt(t.startsAt, t.endsAt) <= now);
  let sent = 0;
  for (const t of due) {
    // Claimed first, so two runs at once send one notice.
    const claimed = await db.update(ownerTrials).set({ remindedAt: new Date(now) }).where(and(eq(ownerTrials.id, t.id), isNull(ownerTrials.remindedAt))).returning({ id: ownerTrials.id });
    if (!claimed.length) continue;
    const origin = `https://${apexDomain()}`;
    // A run that was missed (the cron down for days) still says something true.
    const ended = t.endsAt.getTime() <= now;
    let notice: { title: string; body: string; linkUrl: string; linkLabel: string; audience: string } | null = null;
    if (t.kind === 'plan' && t.clanId) {
      const clan = await db.query.clans.findFirst({ where: eq(clans.id, t.clanId), columns: { slug: true, kind: true, name: true } });
      if (!clan) continue;
      const tier = tierNameOf(clan.kind, t.tier);
      notice = {
        title: ended ? `${clan.name}: your ${tier} trial has ended` : `${clan.name}: your ${tier} trial ends ${endsInWords(t.endsAt, now)}`,
        body: ended
          ? `${clan.name} is back on what it pays for, and nothing was deleted. Subscribe to get ${tier} back: you are charged the day you subscribe, then every month or year.`
          : `${clan.name} has ${tier} until ${longDate(t.endsAt)}. After that it goes back to what it pays for; nothing is deleted. To keep ${tier}, subscribe any time: you are charged the day you subscribe, then every month or year.`,
        linkUrl: `${origin}${clanBasePath({ slug: clan.slug, kind: clan.kind === 'creator' ? 'creator' : 'clan' })}/admin/${clan.kind === 'creator' ? 'dashboard#plan' : 'plan'}`,
        linkLabel: `Subscribe to ${tier}`,
        audience: `clan:${t.clanId}`,
      };
    } else if (t.kind === 'supporter' && t.userId) {
      const tier = SUPPORTER_TIERS[t.tier as SupporterTierId]?.name ?? 'Supporter';
      notice = {
        title: ended ? `Your ${tier} trial has ended` : `Your ${tier} trial ends ${endsInWords(t.endsAt, now)}`,
        body: ended
          ? `Your ${tier} trial from Anvil is over. Subscribe to get ${tier} back: you are charged the day you subscribe, then every month or year.`
          : `Your ${tier} trial from Anvil runs until ${longDate(t.endsAt)}. To keep ${tier}, subscribe any time: you are charged the day you subscribe, then every month or year.`,
        linkUrl: `${origin}/supporter`,
        linkLabel: `Subscribe to ${tier}`,
        audience: `user:${t.userId}`,
      };
    }
    if (!notice) continue;
    const fields = { inPlugin: false, inBrief: false, byDm: true, level: 'important', expiresInDays: 30 };
    let made = await createNotice({ ...notice, ...fields }, null);
    // A link the notice rules refuse (a host that is not Anvil's, on a dev box) must not lose the reminder.
    if (!made.ok) made = await createNotice({ ...notice, ...fields, linkUrl: '', linkLabel: '' }, null);
    if (made.ok) sent += 1;
  }
  return { sent };
}
