// Loads the clan hall (lib/clanHallMerge) for one clan: its Discord widget, its roster's plugin
// presence, this week's XP and the teams of whatever event is live.

import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clanStaff, eventParticipants, events, memberDailyStats, teams } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { viewerMemberIds } from '@/lib/competitionView';
import { fetchGuildWidget, isSnowflake, type WidgetResult } from '@/lib/discordWidget';
import { HALL_EMBED_KEY, HALL_ENABLED_KEY, HALL_PUBLIC_NAMES_KEY, hallSwitches, mergeClanHall, type ClanHallView, type HallTeam } from '@/lib/clanHallMerge';
import { getDiscordInviteUrl } from '@/lib/pluginConfig';
import { botMadeInviteUrl } from '@/lib/discordWidgetInvite';
import { getSettingMap } from '@/lib/settings';

export { HALL_EMBED_KEY, HALL_ENABLED_KEY, HALL_PUBLIC_NAMES_KEY } from '@/lib/clanHallMerge';

export interface HallConfig {
  guildId: string | null;
  /** Off until an admin turns it on (hallSwitches) — the bot being in the server is not consent. */
  enabled: boolean;
  publicNames: boolean;
  embed: boolean;
}

export async function hallConfig(clanId: number): Promise<HallConfig> {
  const map = await getSettingMap(clanId, ['discord_guild_id', HALL_ENABLED_KEY, HALL_PUBLIC_NAMES_KEY, HALL_EMBED_KEY]);
  const guildId = map.get('discord_guild_id')?.trim() || null;
  return {
    guildId: isSnowflake(guildId) ? guildId : null,
    ...hallSwitches((k) => map.get(k)),
  };
}

/** The widget's raw state for the admin page: is it working, and if not, why. */
export async function hallStatus(clanId: number): Promise<{ config: HallConfig; widget: WidgetResult | null }> {
  const config = await hallConfig(clanId);
  return { config, widget: config.guildId ? await fetchGuildWidget(config.guildId) : null };
}

/**
 * Where a Join button really goes: the clan's own invite (an admin chose it), else the one Discord's
 * widget offers, else one the bot makes so the card always has a way in (lib/discordWidgetInvite) —
 * that last only once the clan has switched the card on, never for the admin's preview of it.
 */
async function pickJoinUrl(
  clanId: number,
  setting: string | null,
  widgetInvite: string | null,
  enabled: boolean,
): Promise<string | null> {
  return setting ?? widgetInvite ?? (enabled ? await botMadeInviteUrl(clanId).catch(() => null) : null);
}

/** The Join destination on its own, for the click-counting redirect (api/discord/join). */
export async function hallJoinUrl(clanId: number): Promise<string | null> {
  const config = await hallConfig(clanId);
  if (!config.guildId || !config.enabled) return null;
  const [setting, result] = await Promise.all([getDiscordInviteUrl(clanId), fetchGuildWidget(config.guildId)]);
  return pickJoinUrl(clanId, setting, result.ok ? result.widget.instantInvite : null, config.enabled);
}

/**
 * Who is looking: an insider (a seat here, or staff) sees names; anybody else sees counts unless the
 * clan chose otherwise. The same rule the clan home uses to pick the member view over the public one.
 */
export async function hallViewer(clanId: number): Promise<{ insider: boolean; accountIds: number[] }> {
  const session = await verifyUser();
  if (!session) return { insider: false, accountIds: [] };
  const seatIds = await viewerMemberIds(clanId, session);
  const accountIds = seatIds.length
    ? (await db.select({ accountId: clanRoster.accountId }).from(clanRoster).where(and(eq(clanRoster.clanId, clanId), inArray(clanRoster.id, seatIds)))).map((r) => r.accountId)
    : [];
  if (seatIds.length > 0) return { insider: true, accountIds };
  const staff = session.userId
    ? await db
        .select({ id: clanStaff.id })
        .from(clanStaff)
        .where(and(eq(clanStaff.clanId, clanId), eq(clanStaff.userId, session.userId)))
        .limit(1)
    : [];
  return { insider: staff.length > 0, accountIds };
}

/**
 * The hall for one clan, or null when it has nothing to show (no server, switched off, or Discord's
 * widget is off for the server). `includeNames` is the caller's decision: members, or everyone when
 * the clan chose that; never an embed on somebody else's site.
 */
export async function clanHallView(
  clanId: number,
  opts: { includeNames: boolean; respectEnabled?: boolean; viewerAccountIds?: number[] },
): Promise<(ClanHallView & { viewerTeamId: number | null }) | null> {
  const config = await hallConfig(clanId);
  if (!config.guildId || (opts.respectEnabled !== false && !config.enabled)) return null;
  const result = await fetchGuildWidget(config.guildId);
  if (!result.ok) return null;

  const now = new Date();
  const nowIso = now.toISOString();
  const weekStart = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);

  const roster = await db
    .select({ accountId: clanRoster.accountId, rsn: clanRoster.rsn, rank: clanRoster.rank, liveStatsAt: clanRoster.liveStatsAt })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt)));
  const accountIds = roster.map((r) => r.accountId);

  const [xpRows, teamRows, inviteUrl] = await Promise.all([
    accountIds.length
      ? db
          .select({ accountId: memberDailyStats.accountId, xp: sql<number>`coalesce(sum(${memberDailyStats.xpGained}), 0)` })
          .from(memberDailyStats)
          .where(and(inArray(memberDailyStats.accountId, accountIds), gte(memberDailyStats.day, weekStart)))
          .groupBy(memberDailyStats.accountId)
      : Promise.resolve([]),
    accountIds.length
      ? db
          .select({ accountId: eventParticipants.accountId, id: teams.id, name: teams.name, color: teams.color })
          .from(eventParticipants)
          .innerJoin(teams, eq(teams.id, eventParticipants.teamId))
          .innerJoin(events, eq(events.id, eventParticipants.eventId))
          .where(
            and(
              eq(events.clanId, clanId),
              inArray(eventParticipants.accountId, accountIds),
              isNull(events.forceEndedAt),
              isNotNull(events.startDate),
              lte(events.startDate, nowIso),
              or(isNull(events.endDate), gte(events.endDate, nowIso)),
            ),
          )
          // Two live events at once is rare; the newest wins, which is the one people are talking about.
          .orderBy(desc(events.startDate))
      : Promise.resolve([]),
    getDiscordInviteUrl(clanId),
  ]);

  const joinUrl = await pickJoinUrl(clanId, inviteUrl, result.widget.instantInvite, config.enabled);

  const weekXp = new Map(xpRows.map((r) => [r.accountId, Number(r.xp) || 0]));
  const teamByAccount = new Map<number, HallTeam>();
  for (const t of teamRows) {
    if (t.accountId != null && !teamByAccount.has(t.accountId)) teamByAccount.set(t.accountId, { id: t.id, name: t.name, color: t.color });
  }

  const viewerTeamId = (opts.viewerAccountIds ?? []).map((id) => teamByAccount.get(id)?.id).find((id) => id != null) ?? null;

  const view = mergeClanHall({
    widget: result.widget,
    roster,
    weekXp,
    teamByAccount,
    inviteUrl: joinUrl,
    includeNames: opts.includeNames,
    now: now.getTime(),
  });
  return { ...view, viewerTeamId: opts.includeNames ? viewerTeamId : null };
}
