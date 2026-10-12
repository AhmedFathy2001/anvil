import { and, eq, inArray, isNotNull, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { clanStaff, clans, events, users } from '@/db/schema';
import { sendDiscordWebhook } from '@/lib/discord';
import { discordRest, getBotTokenOnly } from '@/lib/discord-roles';
import { ANVIL_LOGO_URL, EMBED_COLOR, POWERED_BY } from '@/lib/discordEmbeds';
import { eventMediaUrls } from '@/lib/eventMediaRetention';
import { effectivePurgeAt, purgeNoticeDue, type RetentionState } from '@/lib/eventMediaRetentionRules';
import { purgeNoticeText } from '@/lib/eventMediaNoticeText';
import { log } from '@/lib/logger';
import { escapeHtml, isMailConfigured, sendMail } from '@/lib/mailer';
import { absoluteUrl, clanCanonicalPath } from '@/lib/seo';

// The reminders before an event's proof images are deleted (rules: lib/eventMediaRetentionRules).
// They go to the hosting clan's owner and admins — the people who can download the archive — by
// Discord DM from the clan's bot and by email when email is set up (lib/mailer). When neither
// reaches anyone, the clan's general channel gets the notice instead, so it is never silent.
//
// The event is stamped whether or not anything was delivered: the stamp is what starts the week's
// grace, and an event nobody can be told about must still be deletable. The event admin page says
// the same date regardless.

export interface NoticeResult {
  eventId: number;
  eventName: string;
  stage: 'first' | 'final';
  files: number;
  purgeAt: string;
  dms: number;
  emails: number;
  channel: boolean;
  dryRun: boolean;
}

type Row = RetentionState & { id: number; name: string; clanId: number };

/** Events with a reminder due now. */
export async function eventsNeedingNotice(now: Date, limit = 20): Promise<(Row & { stage: 'first' | 'final' })[]> {
  // clan-scope: global -- retention applies to every clan's events alike.
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      clanId: events.clanId,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
      mediaPurgeNoticeAt: events.mediaPurgeNoticeAt,
      mediaPurgeFinalNoticeAt: events.mediaPurgeFinalNoticeAt,
    })
    .from(events)
    .where(
      and(
        isNull(events.mediaPurgedAt),
        isNull(events.mediaPurgeFinalNoticeAt),
        or(isNotNull(events.endDate), isNotNull(events.forceEndedAt)),
      ),
    );
  return rows
    .map((r) => ({ ...r, stage: purgeNoticeDue(r, now) }))
    .filter((r): r is Row & { stage: 'first' | 'final' } => r.stage != null)
    .slice(0, limit);
}

/** The clan's owner and admins, with whatever we can reach them on. */
async function clanAdmins(clanId: number): Promise<{ discordId: string | null; email: string | null }[]> {
  return db
    .selectDistinct({ discordId: users.discordId, email: users.email })
    .from(clanStaff)
    .innerJoin(users, eq(users.id, clanStaff.userId))
    .where(and(eq(clanStaff.clanId, clanId), inArray(clanStaff.role, ['owner', 'admin'])));
}

async function sendDm(botToken: string, discordId: string, body: Record<string, unknown>): Promise<boolean> {
  const dm = await discordRest(botToken, '/users/@me/channels', {
    method: 'POST',
    body: JSON.stringify({ recipient_id: discordId }),
  });
  if (!dm.ok) return false;
  const channel = (await dm.json()) as { id: string };
  const res = await discordRest(botToken, `/channels/${channel.id}/messages`, { method: 'POST', body: JSON.stringify(body) });
  return res.ok;
}

/** Send one event's due reminder and stamp it. With dryRun, says what would go out and touches nothing. */
export async function sendPurgeNotice(
  e: Row & { stage: 'first' | 'final' },
  now: Date,
  opts: { dryRun?: boolean } = {},
): Promise<NoticeResult> {
  const media = await eventMediaUrls(e.id);
  const files = media.submissions.length + media.fees.length + media.payouts.length + media.startProofs.length;
  // Stamping first fixes the date this reminder promises (the grace runs from now).
  const stamped: RetentionState =
    e.stage === 'first' ? { ...e, mediaPurgeNoticeAt: now.toISOString() } : { ...e, mediaPurgeFinalNoticeAt: now.toISOString() };
  const purgeAt = effectivePurgeAt(stamped, now)!;
  const result: NoticeResult = {
    eventId: e.id,
    eventName: e.name,
    stage: e.stage,
    files,
    purgeAt: purgeAt.toISOString(),
    dms: 0,
    emails: 0,
    channel: false,
    dryRun: !!opts.dryRun,
  };
  if (opts.dryRun) return result;

  const stamp = async () => {
    // clan-scope: global -- one event, by id; the job settled which.
    await db
      .update(events)
      .set(e.stage === 'first' ? { mediaPurgeNoticeAt: now.toISOString() } : { mediaPurgeFinalNoticeAt: now.toISOString() })
      .where(eq(events.id, e.id));
  };
  // Nothing stored, nothing to warn about: stamp so the event can be closed out, say nothing.
  if (files === 0) {
    await stamp();
    return result;
  }

  const [clan] = await db.select({ name: clans.name, slug: clans.slug }).from(clans).where(eq(clans.id, e.clanId));
  const archiveUrl = absoluteUrl(clanCanonicalPath(clan?.slug ?? '', `/admin/events/${e.id}`));
  const { subject, lines } = purgeNoticeText({
    stage: e.stage,
    eventName: e.name,
    clanName: clan?.name ?? '',
    purgeAt,
    files,
    archiveUrl,
    now,
  });
  const embed = {
    title: subject,
    url: archiveUrl,
    description: `${lines.join('\n\n')}\n\n[Download the archive](${archiveUrl})`,
    color: e.stage === 'final' ? EMBED_COLOR.red : EMBED_COLOR.amber,
    footer: { text: POWERED_BY, icon_url: ANVIL_LOGO_URL },
  };

  const admins = await clanAdmins(e.clanId);
  const bot = await getBotTokenOnly(e.clanId);
  if (bot) {
    for (const id of new Set(admins.map((a) => a.discordId).filter((d): d is string => !!d))) {
      if (await sendDm(bot.token, id, { embeds: [embed] }).catch(() => false)) result.dms++;
    }
  }
  if (isMailConfigured()) {
    const html =
      lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('') +
      `<p><a href="${escapeHtml(archiveUrl)}">Download the archive</a></p>` +
      '<p style="color:#888;font-size:12px">You get this because you are an owner or admin of this clan on Anvil.</p>';
    const text = `${lines.join('\n\n')}\n\nDownload the archive: ${archiveUrl}\n\nYou get this because you are an owner or admin of this clan on Anvil.`;
    for (const to of new Set(admins.map((a) => a.email?.trim().toLowerCase()).filter((m): m is string => !!m))) {
      if (await sendMail({ to, subject, text, html })) result.emails++;
    }
  }
  if (result.dms === 0 && result.emails === 0) {
    result.channel = await sendDiscordWebhook(e.clanId, { embeds: [embed] }).catch(() => false);
  }
  await stamp();
  log.info('media-retention.notice', { eventId: e.id, stage: e.stage, files, dms: result.dms, emails: result.emails, channel: result.channel });
  return result;
}
