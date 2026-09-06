import { db } from '@/db';
import { events, eventParticipants, clanRoster, users } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

import { getLadderBoards } from '@/lib/ladderStandings';
import { monthKeyWindow, monthWindowUtc, previousMonthKey } from '@/lib/monthWindow';
import { parseEventRules } from '@/lib/eventRules';
import { getSettingText, setSetting } from '@/lib/settings';
import { discordRest, getBotCredentials } from '@/lib/discord-roles';
import { notifyMonthlyChampion } from '@/lib/discord';
import { log } from '@/lib/logger';

// The end of a month on a running ladder.
//
// A board that resets monthly and keeps an all-time table has one moment nobody is awake for: the
// month ending. Until now that moment passed silently — the monthly column simply started counting
// from zero again, and whoever had won it found out by remembering to look before midnight.
//
// So the engine closes the month itself: name the winner in Discord, hand them the role the clan set
// aside for it, and take it back off last month's holder. Nothing about the standings changes — the
// monthly board was always a window over completedAt (see lib/ladderStandings), and this reads the
// window that just closed rather than computing anything new.
//
// Idempotent on a settings key holding the last month settled per event, because the pass runs on
// the ordinary cron tick and "did we already crown August?" must survive a restart.

const SETTLED_KEY = (eventId: number) => `ladder_month_settled:${eventId}`;

export interface MonthlyResult {
  eventId: number;
  month: string;
  winnerRsn: string | null;
  points: number;
  announced: boolean;
  roleGranted: boolean;
}

/**
 * Close out any month that has ended on this event, at most once.
 *
 * Runs for a ladder that opted in (`rules.monthlyAward`). Silent for everything else, and silent
 * again on the second call within the same month.
 */
export async function settleLadderMonth(event: typeof events.$inferSelect): Promise<MonthlyResult | null> {
  const rules = parseEventRules(event.rules);
  const cfg = rules.monthlyAward;
  if (!cfg) return null;

  const month = previousMonthKey();
  const settled = await getSettingText(event.clanId, SETTLED_KEY(event.id));
  if (settled === month) return null;
  // A board that started this month has no previous month of its own to crown.
  const { start } = monthKeyWindow(month);
  if (event.startDate && event.startDate >= monthWindowUtc().start) {
    await setSetting(event.clanId, SETTLED_KEY(event.id), month);
    return null;
  }

  const boards = await getLadderBoards(event, monthKeyWindow(month));
  const winner = boards.monthly[0];
  if (!winner || winner.points <= 0) {
    // A quiet month still counts as settled: without this the pass would re-ask every minute for
    // the rest of the following month.
    await setSetting(event.clanId, SETTLED_KEY(event.id), month);
    log.info('ladder-month.empty', { eventId: event.id, month });
    return { eventId: event.id, month, winnerRsn: null, points: 0, announced: false, roleGranted: false };
  }

  let roleGranted = false;
  if (cfg.roleId) {
    roleGranted = await moveChampionRole({
      clanId: event.clanId,
      eventId: event.id,
      roleId: cfg.roleId,
      winnerPlayerId: winner.playerId,
    });
  }

  let announced = false;
  if (cfg.announce) {
    announced = await notifyMonthlyChampion({
      clanId: event.clanId,
      eventId: event.id,
      eventName: event.name,
      month,
      rsn: winner.name,
      points: winner.points,
      tasks: winner.tasks,
      runnersUp: boards.monthly.slice(1, 3).map((s) => ({ rsn: s.name, points: s.points })),
      roleGranted,
    }).catch(() => false);
  }

  await setSetting(event.clanId, SETTLED_KEY(event.id), month);
  log.info('ladder-month.settled', { eventId: event.id, month, winner: winner.name, points: winner.points, since: start });
  return { eventId: event.id, month, winnerRsn: winner.name, points: winner.points, announced, roleGranted };
}

/**
 * Hand the champion role to this month's winner and take it off whoever held it.
 *
 * "Whoever held it" is read from Discord rather than from a column we keep: the role is the clan's,
 * and somebody may have granted or removed it by hand. Trusting our own record would fight them.
 */
async function moveChampionRole(args: {
  clanId: number;
  eventId: number;
  roleId: string;
  winnerPlayerId: number;
}): Promise<boolean> {
  const creds = await getBotCredentials(args.clanId);
  if (!creds) return false;

  const winnerDiscordId = await discordIdForParticipant(args.eventId, args.winnerPlayerId);
  if (!winnerDiscordId) {
    log.info('ladder-month.no-discord', { eventId: args.eventId, playerId: args.winnerPlayerId });
    return false;
  }

  // Everyone currently wearing it. Discord pages members at 1000, which is far past any clan that
  // fits in one guild, and this asks for the whole list because the role is usually on one person.
  const membersRes = await discordRest(creds.botToken, `/guilds/${creds.guildId}/members?limit=1000`);
  if (membersRes.ok) {
    const members = (await membersRes.json()) as { user?: { id: string }; roles?: string[] }[];
    for (const m of members) {
      const id = m.user?.id;
      if (!id || id === winnerDiscordId) continue;
      if (!m.roles?.includes(args.roleId)) continue;
      const res = await discordRest(
        creds.botToken,
        `/guilds/${creds.guildId}/members/${id}/roles/${args.roleId}`,
        { method: 'DELETE' },
      );
      if (!res.ok && res.status !== 404) {
        log.warn('ladder-month.role-strip-fail', { status: res.status, discordUserId: id });
      }
    }
  }

  const res = await discordRest(
    creds.botToken,
    `/guilds/${creds.guildId}/members/${winnerDiscordId}/roles/${args.roleId}`,
    { method: 'PUT' },
  );
  if (!res.ok) {
    log.warn('ladder-month.role-grant-fail', { status: res.status, discordUserId: winnerDiscordId });
    return false;
  }
  return true;
}

/**
 * The Discord account behind a scoring row: the person who owns the character, by their proven OAuth
 * link, falling back to the roster's name-matched id. The fallback is weaker on purpose — it is a
 * cache, not proof — but a clan whose members have never signed in still gets its role handed out.
 */
async function discordIdForParticipant(eventId: number, playerId: number): Promise<string | null> {
  const [participant] = await db
    .select({ clanMemberId: eventParticipants.clanMemberId })
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.id, playerId)))
    .limit(1);
  if (!participant?.clanMemberId) return null;

  // clan-scope: global -- the seat id came from this event's own participant row, which is already
  // scoped to the event's clan.
  const [seat] = await db
    .select({ playerId: clanRoster.playerId, discordId: clanRoster.discordId })
    .from(clanRoster)
    .where(eq(clanRoster.id, participant.clanMemberId))
    .limit(1);
  if (!seat) return null;

  if (seat.playerId != null) {
    const [user] = await db
      .select({ discordId: users.discordId })
      .from(users)
      .where(eq(users.playerId, seat.playerId))
      .limit(1);
    if (user?.discordId) return user.discordId;
  }
  return seat.discordId ?? null;
}

/** Cron pass: settle the month on every live ladder that asked for it. */
export async function settleLadderMonths(): Promise<MonthlyResult[]> {
  // clan-scope: global -- one pass covers every clan's ladders; each event is handled on its own clanId.
  const rows = await db.select().from(events).where(inArray(events.format, ['ladder']));
  const out: MonthlyResult[] = [];
  for (const event of rows) {
    if (event.forceEndedAt) continue;
    if (event.endDate && event.endDate < new Date().toISOString()) continue;
    try {
      const result = await settleLadderMonth(event);
      if (result) out.push(result);
    } catch (err) {
      log.warn('ladder-month.fail', { eventId: event.id, err: String(err) });
    }
  }
  return out;
}
