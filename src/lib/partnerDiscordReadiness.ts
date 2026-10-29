// The host's list of its co-host clans' Discord for one board: where each one's posts land, whether
// its bot is connected, whether it hands out its player role, and whether its own teams' channels are
// built in its server. Facts only — never a partner's webhook, role or channel ids (lib/partnerReadiness
// turns them into words).

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { events, teamDiscordResources, teams } from '@/db/schema';
import { cohostsForEvent } from '@/lib/coHost';
import { cohostChannelReady } from '@/lib/discord';
import { getBotCredentials } from '@/lib/discord-roles';
import { cohostBingoRoleReady } from '@/lib/discord-teams';
import { autoTeamChannels } from '@/lib/eventDiscord';
import { isDiscordLayout, planTeamPlacement, type DiscordLayout } from '@/lib/eventDiscordPlan';
import { readEventDiscordPrefs, readPartnerDiscordPrefs } from '@/lib/eventDiscordPrefs';
import { partnerPosts, partnerVerdict, type PartnerFacts, type PartnerPosts } from '@/lib/partnerReadiness';

export interface PartnerReadiness {
  clanId: number;
  name: string;
  /** Hasn't accepted yet: nothing of theirs runs for this board. */
  pending: boolean;
  posts: PartnerPosts;
  verdict: 'ready' | 'partial' | 'nothing';
  facts: PartnerFacts;
}

export async function partnerDiscordReadiness(eventId: number, hostClanId: number): Promise<PartnerReadiness[]> {
  const rows = (await cohostsForEvent(eventId)).filter((r) => r.clanId !== hostClanId && (r.status === 'accepted' || r.status === 'pending'));
  if (rows.length === 0) return [];
  // clan-scope: global -- the host's own event, which the caller has already scoped.
  const [event, hostPrefs, eventTeams] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, eventId), columns: { discordLayout: true } }),
    readEventDiscordPrefs(eventId),
    db.select({ id: teams.id, clanId: teams.clanId }).from(teams).where(eq(teams.eventId, eventId)),
  ]);
  const layout = (isDiscordLayout(event?.discordLayout) ? event!.discordLayout : 'own') as DiscordLayout;
  const hostShare: PartnerFacts['hostShare'] = hostPrefs.cohosts === false ? 'none' : (hostPrefs.partnerShare ?? 'all');
  const built = eventTeams.length
    ? await db
        .select()
        .from(teamDiscordResources)
        .where(and(inArray(teamDiscordResources.teamId, eventTeams.map((t) => t.id)), eq(teamDiscordResources.purpose, 'planning')))
    : [];

  return Promise.all(
    rows.map(async (row) => {
      const [prefs, defaultChannel, creds, playerRoleReady, auto] = await Promise.all([
        readPartnerDiscordPrefs(eventId, row.clanId),
        cohostChannelReady(row.clanId),
        getBotCredentials(row.clanId),
        cohostBingoRoleReady(eventId, row.clanId),
        autoTeamChannels(eventId, row.clanId, hostClanId),
      ]);
      const own = eventTeams.filter((t) =>
        planTeamPlacement(layout, t, hostClanId).some((p) => p.server === 'clan' && p.clanId === row.clanId),
      );
      const teamsBuilt = own.filter((t) =>
        built.some((r) => r.teamId === t.id && r.clanId === row.clanId && r.roleId && r.textChannelId && r.voiceChannelId),
      ).length;
      const facts: PartnerFacts = {
        hostShare,
        preset: prefs.preset ?? 'host',
        ownChannel: !!prefs.webhookUrl,
        defaultChannel,
        botConnected: !!creds,
        playerRoleReady,
        ownTeams: own.length,
        teamsBuilt,
        autoTeamChannels: auto,
      };
      return {
        clanId: row.clanId,
        name: row.clanName,
        pending: row.status === 'pending',
        posts: partnerPosts(facts),
        verdict: partnerVerdict(facts),
        facts,
      };
    }),
  );
}
