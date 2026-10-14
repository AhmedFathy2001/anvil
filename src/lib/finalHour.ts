// The "final hour" heads-up (admin → Send final-hour heads-up): one countdown post to every clan on
// the board (host bingo channel + each co-host's, member role pinged — lib/discord sendEventBingoWebhook),
// plus a ping of each TEAM's role in that team's own private channel.
//
// Team channels are bot-posted, never webhooked: there's no webhook in a team's private channel. Each
// channel is posted with the bot of the clan that made it — the host's for the classic in-server
// layout (teams.discord*), and `team_discord_resources.clanId` for the event-server / planning
// layouts, which is also the only clan allowed to touch those channels.

import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { events, teams, teamDiscordResources } from '@/db/schema';
import { discordRest, getBotTokenOnly } from '@/lib/discord-roles';
import { finalHourEmbed, notifyFinalHour } from '@/lib/discord';
import { parseEventRules } from '@/lib/eventRules';
import { log } from '@/lib/logger';

export interface FinalHourResult {
  clans: boolean;
  teams: { team: string; ok: boolean; error?: string }[];
}

export async function sendFinalHour(eventId: number): Promise<FinalHourResult | { error: string }> {
  // clan-scope: global -- the caller has already proved this clan hosts the event.
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { error: 'Not found' };
  if (!event.startDate) return { error: 'This event has no start time yet.' };
  if (new Date(event.startDate).getTime() <= Date.now()) return { error: 'This event has already started.' };

  const params = {
    clanId: event.clanId,
    eventId,
    eventName: event.name,
    startDate: event.startDate,
    startProof: !!parseEventRules(event.rules).startProof,
  };
  const clansOk = await notifyFinalHour(params);

  const eventTeams = await db
    .select({ id: teams.id, name: teams.name, roleId: teams.discordRoleId, channelId: teams.discordTextChannelId })
    .from(teams)
    .where(eq(teams.eventId, eventId));
  const teamName = new Map(eventTeams.map((t) => [t.id, t.name]));

  const targets: { clanId: number; team: string; roleId: string; channelId: string }[] = [];
  for (const t of eventTeams) {
    if (t.roleId && t.channelId) targets.push({ clanId: event.clanId, team: t.name, roleId: t.roleId, channelId: t.channelId });
  }
  if (eventTeams.length > 0) {
    const rows = await db
      .select()
      .from(teamDiscordResources)
      .where(
        and(
          inArray(teamDiscordResources.teamId, eventTeams.map((t) => t.id)),
          isNotNull(teamDiscordResources.roleId),
          isNotNull(teamDiscordResources.textChannelId),
        ),
      );
    for (const r of rows) {
      targets.push({ clanId: r.clanId, team: teamName.get(r.teamId) ?? 'Team', roleId: r.roleId!, channelId: r.textChannelId! });
    }
  }

  const embed = finalHourEmbed(params);
  const tokens = new Map<number, string | null>();
  const teamResults = await Promise.all(
    targets.map(async (t) => {
      if (!tokens.has(t.clanId)) tokens.set(t.clanId, (await getBotTokenOnly(t.clanId))?.token ?? null);
      const token = tokens.get(t.clanId);
      if (!token) return { team: t.team, ok: false, error: 'No bot for that server' };
      const res = await discordRest(token, `/channels/${t.channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: `<@&${t.roleId}> **${event.name}** starts <t:${Math.floor(new Date(event.startDate!).getTime() / 1000)}:R>.`,
          embeds: [embed],
          allowed_mentions: { roles: [t.roleId] },
        }),
      });
      if (!res.ok) {
        log.warn('final-hour.team-post-fail', { eventId, team: t.team, status: res.status });
        return { team: t.team, ok: false, error: `Discord ${res.status}` };
      }
      return { team: t.team, ok: true };
    }),
  );

  return { clans: clansOk, teams: teamResults };
}
