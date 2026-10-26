import { pluginLevelRules } from '@/lib/levelRulesStore';
import { resolvePluginClan } from '@/lib/auth';
import { noClanForPlugin } from '@/lib/pluginNoClan';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { events, eventParticipants } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyPluginToken, verifyPluginTokenUser, normalizeRsn, pluginRsnHintOnly, pluginViewerRsn } from '@/lib/auth';
import { eventTimeState } from '@/lib/eventTime';
import {
  buildSchedule,
  pluginScheduleViewer,
  personalBestActivities,
} from '@/lib/pluginConfig';
import { jsonWithEtag } from '@/lib/httpEtag';
import { serverInfo } from '@/lib/serverInfo';
import { pluginClansFor } from '@/lib/pluginClans';
import { combatTaskVarps } from '@/lib/combatTasks';
import { accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { homeBoardForUser } from '@/lib/pluginHomeBoard';
import { panelSchedule } from '@/lib/pluginPanel';
import { buildEnrolledConfig, clanPluginSettings, notifyFlags, pluginRollTables } from '@/lib/pluginConfigEnrolled';

/**
 * When a token holder resolves to no active event, check whether the RSN they're logged into is
 * actually a drafted player in an event that's LIVE right now — i.e. they're in a bingo but their
 * account isn't linked to it (unverified RSN, or the player row belongs to another user). Returns
 * that event's name so the plugin can warn them; null when the RSN isn't in any live event.
 */
async function activeEventForUnlinkedRsn(request: Request, clanId: number): Promise<string | null> {
  const rsnHeader = request.headers.get('X-RSN')?.trim();
  if (!rsnHeader) return null;
  const norm = normalizeRsn(rsnHeader);
  if (!norm) return null;
  // THIS CLAN'S BOARDS. Unscoped, it searched every clan on the platform for a live event with this
  // RSN on it — and a token is scoped to ONE clan, so somebody in two of them got told their drops
  // would not count in the clan they were connected to, naming a board belonging to the other one.
  // The warning was true of nowhere: they were properly linked where the event actually lives.
  //
  // It also said another clan's event name to a clan with no part in it, which is the leak half of
  // the same line.
  const rows = await db
    .select({
      name: eventParticipants.name,
      eventName: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      forceEndedAt: events.forceEndedAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(and(eq(events.clanId, clanId), sql`lower(${eventParticipants.name}) = ${norm}`));
  const now = Date.now();
  for (const r of rows) {
    if (normalizeRsn(r.name) !== norm) continue; // exact (nbsp-normalised) match
    if (eventTimeState({ startDate: r.startDate, endDate: r.endDate, forceEndedAt: r.forceEndedAt, now }).phase === 'active') {
      return r.eventName;
    }
  }
  return null;
}

export async function GET(request: Request) {
  // Resolve the PLAYER before resolving the clan.
  //
  // This ordering is load-bearing for a newly signed-in Discord user whose character already came
  // from clan sync. Their token cannot name a clan yet because the synced seat still belongs to the
  // roster placeholder person. `verifyPluginToken` runs resolvePluginMember, which uses the played
  // RSN to find that unclaimed seat, claims the account and folds the placeholder into the Discord
  // person. Only then can the token name the clan. Resolving the clan first returned 404 here and
  // skipped that work forever, even though /config is the first request the plugin makes on login.
  //
  // At the login screen the plugin may send only the Jagex Launcher's character name (X-RSN-Hint). That
  // resolves the same entry read-only, so the panel shows the right board before Play — and none of the
  // claim work above runs until the real login sends X-RSN.
  const auth = await verifyPluginToken(request, { hintOnly: pluginRsnHintOnly(request) });

  // See lib/pluginNoClan for why this is answered rather than thrown.
  const clan = await resolvePluginClan(request);
  if (!clan) return noClanForPlugin();
  if (!auth) {
    // Distinguish "bad token" from "valid token but no active event" so the plugin
    // doesn't surface a misleading "failed to connect" when the user just isn't
    // enrolled anywhere right now.
    const userOnly = await verifyPluginTokenUser(request);
    if (userOnly) {
      // Valid token, no live event: still resolve the read-bootstrap (schedule, weekly,
      // notification webhooks, fun-death pool) so deaths/rare-drops post and the side
      // panel shows the schedule even when the player isn't enrolled anywhere.
      const [schedule, clanSettings, unlinkedActiveEvent, homeBoard, switchableClans] =
        await Promise.all([
          pluginScheduleViewer(clan.id, userOnly.userId).then((v) => buildSchedule(clan.id, { ...v, viewerRsn: pluginViewerRsn(request), viewerAccountHash: request.headers.get('x-account-hash') })),
          clanPluginSettings(clan.id),
          activeEventForUnlinkedRsn(request, clan.id),
          homeBoardForUser(clan.id, userOnly.userId),
          pluginClansFor(userOnly.userId, pluginViewerRsn(request)),
        ]);
        // Whose character this is, when it isn't resolving as theirs — so the sidebar can say
        // "linked to another Anvil account" instead of tracking nothing without a word.
        const character = playedCharacter(request);
        const standing = character ? await accountStanding(userOnly.userId, character) : null;
        const { activeWeekly, weeklyNames, webhooks, funDeathMessages, deathTaunts, spoonTaunts, alwaysNotifyItems, showKillCount, dropRarityFloor, facts, alwaysNotifyItemIds } = clanSettings;
      return jsonWithEtag(request, {
        // Version + capability handshake — present on every /config shape (enrolled or not) so the
        // plugin can gate features per-site. Old plugins ignore it (GSON drops unknown fields).
        server: serverInfo(),
        // 'yours' | 'other' | 'ignored' | 'unclaimed' for the logged-in character (lib/pluginAccount);
        // null at the login screen. Old plugins ignore it.
        accountStanding: standing,
        event: null,
        team: null,
        player: null,
        // The clan's display name — the sidebar's clan-filter label and the logged-out home card
        // need it even when no event/team is resolvable for this token.
        clanName: clanSettings.clanName,
        // WHICH CLAN THIS ANSWER IS ABOUT, and where else this person could point the plugin.
        // The plugin echoes activeClan.slug back as a `/c/<slug>` prefix, so once it has asked
        // once, every later call is addressed rather than re-resolved (lib/pluginClans).
        activeClan: { slug: clan.slug, name: clan.name },
        clans: switchableClans,
        // Server-resolved board summary off the token's USER (linked member → live enrollment), so
        // the sidebar shows the home board even at the login screen. Null when not enrolled anywhere.
        homeBoard,
        // Non-null when the logged-in RSN IS a player in a live bingo but this token/account isn't
        // linked to it — the plugin surfaces a "verify your RSN" warning so tracking isn't silently off.
        unlinkedActiveEvent,
        codeword: null,
        // No event resolved → nothing to prove (lib/startProof). Present for shape parity.
        startProof: null,
        // Profile sync runs with or without an event, so the PB import needs its names here too.
        pbActivities: personalBestActivities(),
        // The varps combat-achievement completion is bit-packed into. Sent from here so a game
        // update that adds one is a data change on the server, not a plugin release.
        caVarps: combatTaskVarps(),
        trackedStats: [],
        // With no bingo event the plugin still pushes the active SOTW/BOTW metric so weekly moves live.
        trackedKcNames: weeklyNames.kc,
        trackedSkillNames: weeklyNames.skills,
        // Weekly comps rank on a skill or a boss only — the picker offers nothing else — so there's
        // never an activity to push without a bingo event behind it.
        trackedActivityKeys: [],
        trackedDrops: [],
        trackedKills: [],
        trackedPvp: [],
        pvpRoster: [],
        trackedTimed: [],
        trackedLms: [],
        trackedValues: [],
        trackedGains: [],
        trackedDeathless: [],
        trackedDiaries: [],
        trackedCombatTasks: [],
        noActiveEvent: true,
        rollTables: pluginRollTables,
        schedule,
        activeWeekly,
        notify: notifyFlags(webhooks),
        funDeathMessages,
        deathTaunts,
        spoonTaunts,
        alwaysNotifyItems,
        alwaysNotifyItemIds,
        showKillCount,
        dropRarityFloor,
        // Which level-ups / total-level steps this member's posts announce (lib/levelRules,
        // capability 'level-rules'): the clan channel's effective rules and their personal webhooks'.
        levelRules: await pluginLevelRules(clan.id, userOnly.userId),
        // What only the server can know about a drop (lib/dropFacts): which monster a pet really
        // comes from, and which items a source hands over every kill. Posted drops read from these
        // instead of guessing from the last loot event.
        dropFacts: facts,
        // No board to draw rows for — the panel still lists the schedule (lib/pluginPanel).
        panel: {
          tiles: [],
          activeNow: [],
          ...panelSchedule(schedule, { ids: [homeBoard?.eventId ?? -1], title: homeBoard ? null : unlinkedActiveEvent }),
        },
      });
    }
    return NextResponse.json({ error: 'Unauthorized. Provide Authorization: Bearer <accountToken>' }, { status: 401 });
  }

  const built = await buildEnrolledConfig({
    eventId: auth.eventId,
    teamId: auth.teamId,
    clan,
    viewer: { playerId: auth.playerId, userId: auth.userId, rsn: auth.rsn, request },
  });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });
  return jsonWithEtag(request, built.body);
}
