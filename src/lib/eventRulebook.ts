// One read of everything a board's rules say, for every surface that shows them: `/bingo rules` in
// any clan on the board, the rules post (lib/eventRulesPost) and the event page's Rules card.
//
// The rulebook resolves from the EVENT — its own text, else its HOST clan's house rules — never from
// whoever is asking. A co-host's Discord reading its own house rules for somebody else's board is
// exactly the drift this module exists to rule out. The words are built in lib/rulesMechanics.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { events, settings, teams, tiles, eventParticipants } from '@/db/schema';
import { eventPoolGp } from '@/lib/coffer';
import { boardTiles, missionTiles, parseEventRules } from '@/lib/eventRules';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { computePrizePool, countApprovedSignups } from '@/lib/prizePool';
import { pickRulebook, type Rulebook, type RulesFacts } from '@/lib/rulesMechanics';

/** The host clan's house rules (settings `board_rules` / `board_rules_url`), scoped to that clan. */
async function readHouseRules(clanId: number): Promise<{ text: string | null; url: string | null }> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(and(eq(settings.clanId, clanId), inArray(settings.key, ['board_rules', 'board_rules_url'])));
  const map = new Map(rows.map((r) => [r.key, r.value?.trim() || null]));
  return { text: map.get('board_rules') ?? null, url: map.get('board_rules_url') ?? null };
}

/** The rulebook for a board row: its own text, else its host clan's. */
export async function rulebookForEvent(row: { clanId: number; rulebook: string | null }): Promise<Rulebook> {
  const [house, hostName] = await Promise.all([
    readHouseRules(row.clanId),
    getClanDisplayName(row.clanId).catch(() => 'Anvil'),
  ]);
  return pickRulebook(row.rulebook, house.text, house.url, hostName);
}

/**
 * Every fact the rules read about one board. Null when the event doesn't exist.
 *
 * Takes an id whose caller has already settled the clan (eventScope / discordContext.loadEvent) —
 * the 'one hop, never a copy' rule.
 */
export async function loadRulesFacts(eventId: number): Promise<RulesFacts | null> {
  // clan-scope: global -- takes an entity id whose caller has already settled the clan (host or accepted co-host).
  const row = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!row) return null;

  const [allTiles, playerRows, approved, cofferFunded, rulebook] = await Promise.all([
    db
      .select({ id: tiles.id, mission: tiles.mission, revealedAt: tiles.revealedAt, trackedStat: tiles.trackedStat })
      .from(tiles)
      .where(eq(tiles.eventId, eventId)),
    db.select({ id: eventParticipants.id }).from(eventParticipants).where(eq(eventParticipants.eventId, eventId)),
    countApprovedSignups(eventId).catch(() => 0),
    eventPoolGp(eventId).catch(() => 0),
    rulebookForEvent(row),
  ]);

  const pool = computePrizePool({
    addedPrizePool: row.addedPrizePool ?? null,
    signupFee: row.signupFee ?? null,
    approvedCount: approved,
    cofferFunded,
  });
  const missionPool = missionTiles(allTiles);

  return {
    event: {
      id: row.id,
      name: row.name,
      scoringMode: row.scoringMode,
      format: row.format,
      tilesRevealed: row.tilesRevealed === 1,
      playerCount: playerRows.length,
    },
    rules: parseEventRules(row.rules),
    pool,
    fee: row.signupFee ?? null,
    missionCounts: { total: missionPool.length, announced: missionPool.filter((t) => t.revealedAt).length },
    boardTiles: boardTiles(allTiles),
    rulebook,
  };
}

/** Team count for the rules post's header field (the slash command already has it on EventContext). */
export async function eventTeamCount(eventId: number): Promise<number> {
  const rows = await db.select({ id: teams.id }).from(teams).where(eq(teams.eventId, eventId));
  return rows.length;
}
