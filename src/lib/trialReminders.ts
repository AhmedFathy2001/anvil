// "Remind me when the trial ends" (components/TrialCard): the notice that answers it.
//
// The wish is a timestamp on the trial (owner_trials.remind_requested_at). The daily billing cron
// calls sendTrialReminders, which, for each trial that has now ended and asked, puts ONE notice in the
// existing Anvil inbox (lib/notices) — for a plan trial the clan's owners and admins, for a Supporter
// trial the person — and sends the same by Discord DM only to people who already said yes to DMs
// (the notice's own `byDm` path). No new channel, no email. Stamped so it is sent once.

import { and, eq, isNotNull, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clans, ownerTrials } from '@/db/schema';
import { apexDomain } from '@/lib/apexHost';
import { clanBasePath } from '@/lib/clanScopedPaths';
import { createNotice } from '@/lib/notices';
import { tierNameOf } from '@/lib/planTrialRules';
import { SUPPORTER_TIERS, type SupporterTierId } from '@/lib/supporterTiers';

export async function sendTrialReminders(now = Date.now()): Promise<{ sent: number }> {
  const due = await db
    .select()
    .from(ownerTrials)
    .where(
      and(
        isNotNull(ownerTrials.remindRequestedAt),
        isNull(ownerTrials.remindedAt),
        isNull(ownerTrials.revokedAt),
        sql`${ownerTrials.endsAt} <= ${new Date(now).toISOString()}`,
      ),
    )
    .limit(200);
  let sent = 0;
  for (const t of due) {
    // Claimed first, so two runs at once send one notice.
    const claimed = await db.update(ownerTrials).set({ remindedAt: new Date(now) }).where(and(eq(ownerTrials.id, t.id), isNull(ownerTrials.remindedAt))).returning({ id: ownerTrials.id });
    if (!claimed.length) continue;
    const origin = `https://${apexDomain()}`;
    let notice: { title: string; body: string; linkUrl: string; linkLabel: string; audience: string } | null = null;
    if (t.kind === 'plan' && t.clanId) {
      const clan = await db.query.clans.findFirst({ where: eq(clans.id, t.clanId), columns: { slug: true, kind: true, name: true } });
      if (!clan) continue;
      const tier = tierNameOf(clan.kind, t.tier);
      notice = {
        title: `${clan.name}: your ${tier} trial has ended`,
        body: `You asked to be reminded. ${clan.name} is back on what it pays for, and nothing was deleted. Subscribe to get ${tier} back: you are charged the day you subscribe, then every month or year.`,
        linkUrl: `${origin}${clanBasePath({ slug: clan.slug, kind: clan.kind === 'creator' ? 'creator' : 'clan' })}/admin/${clan.kind === 'creator' ? 'dashboard#plan' : 'plan'}`,
        linkLabel: `Subscribe to ${tier}`,
        audience: `clan:${t.clanId}`,
      };
    } else if (t.kind === 'supporter' && t.userId) {
      const tier = SUPPORTER_TIERS[t.tier as SupporterTierId]?.name ?? 'Supporter';
      notice = {
        title: `Your ${tier} trial has ended`,
        body: `You asked to be reminded. Your ${tier} trial from Anvil is over. Subscribe to get ${tier} back: you are charged the day you subscribe, then every month or year.`,
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
