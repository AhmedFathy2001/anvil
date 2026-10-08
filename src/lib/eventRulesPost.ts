// Post a board's rules into the Discord of every clan playing it — the host's bingo channel, and each
// accepted co-host's co-hosted-boards channel (lib/discord.sendCohostWebhook). Called by the "Post
// rules to Discord" button and, when `rules.rulesAtStart` is on, by the start of the event.
//
// Built PER CLAN, not once and copied: each server reads it in its own bot language, with links to
// its own site (a co-host plays from home), under the same host-authored rulebook.

import { acceptedCohostClanIds } from '@/lib/coHost';
import { clanMarkUrl } from '@/lib/clanMarkUrl';
import { upsertBingoWebhookReport, upsertCohostWebhook } from '@/lib/discord';
import { clanContextById, contextLine, loadEvent } from '@/lib/discordContext';
import { LIMIT, clamp, field, statField } from '@/lib/discordEmbeds';
import { getDiscordDict, resolveLocale } from '@/lib/discordI18n';
import { loadRulesFacts } from '@/lib/eventRulebook';
import { log } from '@/lib/logger';
import { buildRulesEmbeds } from '@/lib/rulesMechanics';
import { eventShapeBadge } from '@/lib/utils';
import { db } from '@/db';
import { events } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export interface RulesPostResult {
  clanId: number;
  clanName: string;
  /** 'skipped' = no channel set up (or the clan turned co-host posts off); not an error. */
  status: 'sent' | 'skipped' | 'failed';
  /** Sent messages are created once, then edited in place on every later post. */
  action?: 'posted' | 'updated';
  messageId?: string;
}

/**
 * Every clan on this board: the host first, then accepted co-hosts. `only` narrows it (the caller
 * has already decided who may target whom).
 */
export async function rulesPostTargets(eventId: number, hostClanId: number, only?: number[]): Promise<number[]> {
  const cohosts = await acceptedCohostClanIds(eventId).catch(() => [] as number[]);
  const all = [hostClanId, ...cohosts.filter((id) => id !== hostClanId)];
  return only ? all.filter((id) => only.includes(id)) : all;
}

export async function postEventRules(
  eventId: number,
  hostClanId: number,
  opts: { clanIds?: number[] } = {},
): Promise<RulesPostResult[]> {
  const [facts, host, targets, eventRow] = await Promise.all([
    loadRulesFacts(eventId),
    clanContextById(hostClanId),
    rulesPostTargets(eventId, hostClanId, opts.clanIds),
    db.query.events.findFirst({
      // clan-scope: this clan -- the event must belong to the host the caller already resolved.
      where: and(eq(events.id, eventId), eq(events.clanId, hostClanId)),
      columns: { rulesMessageIds: true },
    }),
  ]);
  if (!facts) return [];
  const priorMessageIds = eventRow?.rulesMessageIds ?? {};

  // The board's owner on the author line — the same mark whichever server it lands in.
  const author = {
    name: clamp(host.name, LIMIT.author),
    ...(host.origin ? { url: host.origin, icon_url: clanMarkUrl(host.origin, host.slug, host.logoUrl) } : {}),
  };

  const results = await Promise.all(
    targets.map(async (clanId): Promise<RulesPostResult> => {
      try {
        const clan = clanId === hostClanId ? host : await clanContextById(clanId);
        const event = await loadEvent(eventId, clanId);
        if (!event) return { clanId, clanName: clan.name, status: 'skipped' };
        const t = await getDiscordDict(resolveLocale(null, clan.language));
        const embeds = buildRulesEmbeds(t, facts, {
          origin: clan.origin,
          eventUrl: clan.origin ? `${clan.origin}/events/${eventId}` : undefined,
          author,
          fields: [
            field(t.common.fieldFormat, eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules)),
            statField(t.common.fieldTeams, event.teamCount),
          ],
          footer: contextLine(clan, event, undefined, t),
        });
        const delivery =
          clanId === hostClanId
            ? await upsertBingoWebhookReport(clanId, { embeds }, priorMessageIds[String(clanId)])
            : await upsertCohostWebhook(clanId, { embeds }, priorMessageIds[String(clanId)]);
        log.info('event-rules.post', { eventId, clanId, status: delivery.status, action: delivery.action });
        return { clanId, clanName: clan.name, ...delivery };
      } catch (error) {
        log.warn('event-rules.post-fail', { eventId, clanId }, error);
        return { clanId, clanName: String(clanId), status: 'failed' };
      }
    }),
  );

  const nextMessageIds = { ...priorMessageIds };
  let changed = false;
  for (const result of results) {
    if (!result.messageId || nextMessageIds[String(result.clanId)] === result.messageId) continue;
    nextMessageIds[String(result.clanId)] = result.messageId;
    changed = true;
  }
  if (changed) {
    await db.update(events).set({ rulesMessageIds: nextMessageIds }).where(eq(events.id, eventId));
  }
  return results;
}
