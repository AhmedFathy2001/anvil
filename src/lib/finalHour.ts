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
import { discordRest, getBotCredentials, getBotTokenOnly } from '@/lib/discord-roles';
import { acceptedCohostClanIds } from '@/lib/coHost';
import { finalHourEmbed, notifyFinalHour } from '@/lib/discord';
import { parseEventRules } from '@/lib/eventRules';
import { log } from '@/lib/logger';

export interface FinalHourResult {
  clans: { clanId: number; status: 'sent' | 'skipped' | 'failed'; pinged: number }[];
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
    startProof: (() => {
      const sp = parseEventRules(event.rules).startProof;
      return sp ? { maxSessionMinutes: sp.maxSessionMinutes ?? 0 } : null;
    })(),
  };

  const eventTeams = await db
    .select({ id: teams.id, name: teams.name, roleId: teams.discordRoleId, channelId: teams.discordTextChannelId })
    .from(teams)
    .where(eq(teams.eventId, eventId));
  const teamName = new Map(eventTeams.map((t) => [t.id, t.name]));

  const hostGuild = (await getBotCredentials(event.clanId))?.guildId ?? null;
  const targets: { clanId: number; guildId: string | null; team: string; roleId: string; channelId: string }[] = [];
  for (const t of eventTeams) {
    if (t.roleId && t.channelId) targets.push({ clanId: event.clanId, guildId: hostGuild, team: t.name, roleId: t.roleId, channelId: t.channelId });
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
      targets.push({ clanId: r.clanId, guildId: r.guildId, team: teamName.get(r.teamId) ?? 'Team', roleId: r.roleId!, channelId: r.textChannelId! });
    }
  }

  // The bingo-channel post pings the team roles that live in THAT clan's server — a role id means
  // nothing in another guild. A role in a separate event server never reaches a clan's bingo post.
  const clanIds = [event.clanId, ...(await acceptedCohostClanIds(eventId).catch(() => [] as number[]))];
  const rolesByClan = new Map<number, string[]>();
  for (const clanId of new Set(clanIds)) {
    const guild = clanId === event.clanId ? hostGuild : ((await getBotCredentials(clanId))?.guildId ?? null);
    if (!guild) continue;
    rolesByClan.set(clanId, [...new Set(targets.filter((t) => t.guildId === guild).map((t) => t.roleId))]);
  }
  const clanResults = await notifyFinalHour(params, rolesByClan);

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

  return {
    clans: clanResults.map((c) => ({ ...c, pinged: rolesByClan.get(c.clanId)?.length ?? 0 })),
    teams: teamResults,
  };
}
