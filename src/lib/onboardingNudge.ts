// Sending the one setup reminder. Who qualifies and what it says live in lib/onboardingNudgeText.
//
// DISCORD FIRST, because it is the one channel every owner has: there is no other way to sign in.
// A bot can only DM someone it shares a server with, so an owner who never added the bot to their
// server cannot be reached that way. Email is the fallback for them, when mail is configured.
//
// STAMPED WHATEVER HAPPENED. The audit row is written even when nothing could be delivered, so a
// clan that cannot be reached is not tried again every day. That row is also how the operator can
// tell later whether a clan that came back was reminded first.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { discordRest, getBotTokenOnly } from '@/lib/discord-roles';
import { ANVIL_LOGO_URL, EMBED_COLOR, POWERED_BY } from '@/lib/discordEmbeds';
import type { LeadRow } from '@/lib/leadsDigest';
import { log } from '@/lib/logger';
import { renderEmail } from '@/lib/emailTemplates';
import { escapeHtml, isMailConfigured, sendMail } from '@/lib/mailer';
import { NUDGE_EVENT, nudgeEmbedDescription, nudgeReasonFor, nudgeText } from '@/lib/onboardingNudgeText';
import { absoluteUrl, clanCanonicalPath } from '@/lib/seo';

export interface NudgeOutcome {
  slug: string;
  reason: 'unverified' | 'no-members';
  via: 'dm' | 'email' | 'none';
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

/** Discord's `**bold**` as HTML, for the email copy of the same text. Escapes first. */
function mdToHtml(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Remind every stalled clan's owner once. Takes the rows the leads digest already built, so the
 * digest and the reminder can never disagree about which clans are stalled.
 */
export async function sendOnboardingNudges(
  leads: LeadRow[],
  now: number,
  opts: { dryRun?: boolean } = {},
): Promise<NudgeOutcome[]> {
  if (leads.length === 0) return [];

  // clan-scope: global -- the cron's job spans every clan; this reads only the given clans' stamps.
  const stamped = await db
    .selectDistinct({ clanId: clanAuditLog.clanId })
    .from(clanAuditLog)
    .where(and(eq(clanAuditLog.eventType, NUDGE_EVENT), inArray(clanAuditLog.clanId, leads.map((l) => l.id))));
  const done = new Set(stamped.map((s) => s.clanId));

  const out: NudgeOutcome[] = [];
  for (const lead of leads) {
    const reason = nudgeReasonFor(lead, now, done.has(lead.id));
    if (!reason) continue;
    if (opts.dryRun) {
      out.push({ slug: lead.slug, reason, via: 'none' });
      continue;
    }

    const t = nudgeText({
      clanName: lead.name,
      reason,
      setupUrl: absoluteUrl(clanCanonicalPath(lead.slug, '/admin/setup')),
      guideUrl: absoluteUrl('/guide/plugin'),
    });

    let via: NudgeOutcome['via'] = 'none';
    if (lead.ownerDiscordId) {
      const bot = await getBotTokenOnly(lead.id).catch(() => null);
      if (bot) {
        const embed = {
          title: t.subject,
          url: t.cta.url,
          description: nudgeEmbedDescription(t),
          color: EMBED_COLOR.amber,
          footer: { text: POWERED_BY, icon_url: ANVIL_LOGO_URL },
        };
        if (await sendDm(bot.token, lead.ownerDiscordId, { embeds: [embed] }).catch(() => false)) via = 'dm';
      }
    }
    if (via === 'none' && lead.ownerEmail && isMailConfigured()) {
      const [intro, ...rest] = t.lines;
      const { html, text } = renderEmail({
        preheader: escapeHtml(t.subject),
        heading: escapeHtml(t.subject),
        lines: [
          mdToHtml(intro),
          ...t.steps.map((s, i) => `${i + 1}. ${mdToHtml(s)}`),
          ...rest.map(mdToHtml),
          `Stuck? The <a href="${t.guideUrl}">plugin guide</a> has pictures of every step.`,
        ],
        cta: t.cta,
        footnote: 'You get this because you created this clan on Anvil. It is the only reminder we will send.',
      });
      if (await sendMail({ to: lead.ownerEmail.trim(), subject: t.subject, text, html }).catch(() => false)) via = 'email';
    }

    await db.insert(clanAuditLog).values({
      clanId: lead.id,
      eventType: NUDGE_EVENT,
      newValue: JSON.stringify({ reason, via }),
      notes:
        via === 'none'
          ? 'Setup reminder could not be delivered (no shared Discord server, no email).'
          : `Sent the owner a setup reminder by ${via === 'dm' ? 'Discord DM' : 'email'}.`,
    });
    log.info('onboarding-nudge.sent', { clanId: lead.id, slug: lead.slug, reason, via });
    out.push({ slug: lead.slug, reason, via });
  }
  return out;
}
