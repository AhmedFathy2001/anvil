// What the slash commands actually answer.
//
// lib/discordInteractions owns the protocol (signatures, payload shapes, response envelopes) and
// lib/discordContext owns "which clan, which board, who else is in it". This module is the part a
// clan actually experiences: four read-only commands that put the board in the chat window.
//
// Design rules, learned from the notification embeds:
//   - Every answer is EPHEMERAL. Someone checking their own standing shouldn't spam the channel,
//     so the answer comes back private with a Share button under it — one click to post it. There
//     is no `share` option: Discord has no valueless option, so a flag has to read `share: True`,
//     and a button is both fewer keystrokes and visible to people who never knew the option existed.
//   - Every answer is in the reader's language. A PRIVATE answer follows the member's own Discord
//     locale; a SHARED one follows the server's, because the channel reads it and not the sharer.
//   - Every answer carries the same provenance subtext (lib/discordContext contextLine) naming the
//     clan and the board, because one bot serves many clans and a screenshot has no other context.
//   - Every answer goes through stampBrand, so these look like the rest of Anvil's posts.
//   - Nothing here writes. A read command that can't hurt anything can be answered without asking
//     what the invoker's site role is — the board is already visible to every member on the web.
//     Unrevealed boards are the one exception and stay hidden here too.

import { db } from '@/db';
import { events, players, teams, tiles, completions, clanMembers, settings, eventSignups } from '@/db/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { getTeamStandings, type TeamStanding } from '@/lib/statStandings';
import {
  parseEventRules,
  hasRevealPolicy,
  visibleTiles,
  boardTiles,
  missionTiles,
  nextRevealAt,
  nextMissionAt,
  type EventRules,
} from '@/lib/eventRules';
import { signupWindowState } from '@/lib/signup';
import { computePrizePool, countApprovedSignups } from '@/lib/prizePool';
import { formatGp } from '@/lib/adminEventsFormat';
import { eventShapeBadge } from '@/lib/utils';
import {
  EMBED_COLOR,
  LIMIT,
  clamp,
  code,
  field,
  statField,
  teamColorToDecimal,
  type DiscordEmbed,
} from '@/lib/discordEmbeds';
import {
  getClanContext,
  pickEvent,
  getCrossClanContext,
  contextLine,
  resolveInvoker,
  checkGuild,
  type ClanContext,
  type EventContext,
  type CrossClanContext,
} from '@/lib/discordContext';
import { COMMAND_NAME, SUBCOMMAND_ORDER } from '@/lib/discordCommandDefs';
import {
  embedReply,
  textReply,
  invokerId,
  invokerName,
  readSubcommand,
  shareRow,
  type Interaction,
  type InteractionResponse,
} from '@/lib/discordInteractions';
import { fmt, plural, getDiscordDict, resolveLocale, type DiscordDict } from '@/lib/discordI18n';

// ── Shared embed furniture ──────────────────────────────────────────────────────────────────────

/** The author line: whose Anvil answered. Links to the clan's site when it has a public URL. */
function authorOf(clan: ClanContext): DiscordEmbed['author'] {
  return { name: clamp(clan.name, LIMIT.author), url: clan.origin ?? undefined };
}

function eventUrl(clan: ClanContext, eventId: number): string | undefined {
  return clan.origin ? `${clan.origin}/events/${eventId}` : undefined;
}

/** "in 3 days" / "2 days left" — Discord's own relative timestamp, so it ticks in every timezone. */
function relativeTs(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

/** The medal column on a standings table. */
function placeMark(index: number): string {
  return ['🥇', '🥈', '🥉'][index] ?? `${index + 1}.`;
}

/**
 * A standings block as one description body rather than a field per team: Discord caps embeds at 25
 * fields and renders 8 teams of fields as an unreadable grid, where a monospaced list stays a table.
 *
 * `visitingTeamIds` marks teams carrying players from other clans — the cross-clan tell that a
 * leaderboard otherwise hides completely.
 */
function standingsBody(
  t: DiscordDict,
  standings: TeamStanding[],
  cross: CrossClanContext,
  highlightTeamId?: number | null,
): string {
  if (standings.length === 0) return t.common.noTeams;
  const lines = standings.slice(0, 15).map((s, i) => {
    const visiting = cross.visitingTeamIds.has(s.teamId) ? ' 🤝' : '';
    const mine = highlightTeamId === s.teamId ? ' ←' : '';
    // The percentage is BOARD progress, so a team carrying mission bonus shows a score ahead of its
    // percentage. Naming the bonus is what stops that reading as a bug.
    const bonus = s.bonusScore > 0 ? ` ⚡+${s.bonusScore}` : '';
    return `${placeMark(i)} **${clamp(s.name, 60)}**${visiting} — ${code(`${s.score} ${s.unit}`)}${bonus} · ${s.pct}%${mine}`;
  });
  if (standings.length > 15) lines.push(`-# ${fmt(t.common.moreOnSite, { n: standings.length - 15 })}`);
  return lines.join('\n');
}

/** The legend for the ⚡ marker, only when a mission has actually scored for someone. */
function bonusNote(t: DiscordDict, standings: TeamStanding[]): string | null {
  if (!standings.some((s) => s.bonusScore > 0)) return null;
  return t.common.bonusLegend;
}

/** The legend for the 🤝 marker, only when something actually carries it. */
function crossClanNote(t: DiscordDict, cross: CrossClanContext): string | null {
  if (!cross.shared) return null;
  if (cross.visitingTeamNames.length) {
    const names = cross.visitingTeamNames.map((n) => `**${clamp(n, 40)}**`).join(', ');
    return fmt(
      cross.visitingTeamNames.length === 1 ? t.common.visitingClansOne : t.common.visitingClansMany,
      { names },
    );
  }
  return plural(cross.visitingPlayers, t.common.visitingPlayersOne, t.common.visitingPlayersMany);
}

/**
 * The board's shape, in the same words the site and the admin list use: "5×5", "Leagues · 261",
 * "Race · 40". Hand-rolling this said "261×261" for a Leagues board, because `boardSize` is a SIDE
 * on a square grid and a tile COUNT everywhere else — the exact distinction eventShapeBadge exists
 * to encode. Reuse it rather than re-derive it.
 */
function shapeLabel(event: EventContext): string {
  return eventShapeBadge(event.format, event.scoringMode, event.boardSize, event.rules);
}

// ── /bingo board ────────────────────────────────────────────────────────────────────────────────

async function boardEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
): Promise<DiscordEmbed> {
  const [standings, eventRow, allTiles] = await Promise.all([
    getTeamStandings(event.id, event.scoringMode),
    db.query.events.findFirst({ where: eq(events.id, event.id), columns: { rules: true } }),
    db
      .select({
        id: tiles.id,
        mission: tiles.mission,
        revealAt: tiles.revealAt,
        revealedAt: tiles.revealedAt,
        closedAt: tiles.closedAt,
      })
      .from(tiles)
      .where(eq(tiles.eventId, event.id)),
  ]);

  // Count what a MEMBER can see, matching the denominator the standings percentages use: never the
  // hidden mission pool (announcing those is the whole mechanic), and on a drip-feed board only the
  // tiles actually drawn so far — otherwise "3/50" quietly tells everyone how long the board is.
  const rules = parseEventRules(eventRow?.rules);
  const countable = hasRevealPolicy(rules) ? visibleTiles(rules, allTiles) : boardTiles(allTiles);
  const tileIds = countable.map((t) => t.id);
  const doneRows = tileIds.length
    ? await db.select({ tileId: completions.tileId }).from(completions).where(inArray(completions.tileId, tileIds))
    : [];
  const distinctDone = new Set(doneRows.map((r) => r.tileId)).size;

  const when =
    event.phase === 'upcoming'
      ? relativeTs(event.startDate)
      : event.phase === 'running'
        ? relativeTs(event.endDate)
        : null;

  const body: string[] = [];
  if (event.phase === 'upcoming' && when) body.push(fmt(t.board.starts, { when }));
  else if (event.phase === 'running' && when) body.push(fmt(t.board.ends, { when }));
  else if (event.phase === 'ended') body.push(t.board.finished);
  else if (event.phase === 'draft') body.push(t.board.notScheduled);

  if (!event.tilesRevealed) body.push(t.board.hidden);
  if (standings.length) body.push('', standingsBody(t, standings, cross));
  const bonus = bonusNote(t, standings);
  if (bonus) body.push('', `-# ${bonus}`);
  const note = crossClanNote(t, cross);
  if (note) body.push('', note);
  body.push('', contextLine(clan, event, cross, t));

  return {
    title: clamp(fmt(t.board.title, { event: event.name }), LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: event.phase === 'running' ? EMBED_COLOR.green : event.phase === 'ended' ? EMBED_COLOR.blue : EMBED_COLOR.gold,
    author: authorOf(clan),
    fields: [
      field(t.common.fieldFormat, shapeLabel(event)),
      statField(t.common.fieldTeams, event.teamCount),
      statField(t.common.fieldPlayers, event.playerCount),
      // Tile progress is meaningless before a reveal, and stating it would leak the board's size.
      ...(event.tilesRevealed
        ? [statField(t.common.fieldTilesDone, `${distinctDone}/${countable.length}`)]
        : []),
    ],
  };
}

// ── /bingo leaderboard ──────────────────────────────────────────────────────────────────────────

async function leaderboardEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
  myTeamId: number | null,
): Promise<DiscordEmbed> {
  const standings = await getTeamStandings(event.id, event.scoringMode);
  const body: string[] = [standingsBody(t, standings, cross, myTeamId)];
  const bonus = bonusNote(t, standings);
  if (bonus) body.push('', `-# ${bonus}`);
  const note = crossClanNote(t, cross);
  if (note) body.push('', note);
  body.push('', contextLine(clan, event, cross, t));

  const leader = standings[0];
  return {
    title: clamp(fmt(t.leaderboard.title, { event: event.name }), LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    // The leader's colour, so the embed's spine matches who's winning.
    color: leader ? teamColorToDecimal(leader.color) : EMBED_COLOR.gold,
    author: authorOf(clan),
  };
}

// ── /bingo rules ────────────────────────────────────────────────────────────────────────────────
//
// Two kinds of rule get confused with each other, so this command answers both and keeps them
// visibly apart:
//
//   MECHANICS — how THIS board scores and reveals. Anvil knows these exactly (they're the event's
//   own configuration), they differ per board, and they're the ones people actually get wrong:
//   "does first team get a bonus?", "why is that tile locked?", "do I need a starting shot?".
//   Derived fresh every time, so they can never drift from what the board is really doing.
//
//   HOUSE RULES — the clan's own prose: keep a screenshot, use the plugin, don't cheat. Stable
//   across boards, written by staff, and stored as a plain settings row (`board_rules`) so editing
//   them is a text box and not a deploy. `board_rules_url` links the long version.

/** The clan's authored rules, if any. */
async function readHouseRules(): Promise<{ text: string | null; url: string | null }> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, ['board_rules', 'board_rules_url']));
  const map = new Map(rows.map((r) => [r.key, r.value?.trim() || null]));
  return { text: map.get('board_rules') ?? null, url: map.get('board_rules_url') ?? null };
}

/** Sentences describing how the board scores and opens. One bullet per rule that is actually on. */
function mechanicsLines(
  t: DiscordDict,
  event: EventContext,
  rules: EventRules,
  pool: number,
  fee: number | null,
  missionCounts: { total: number; announced: number },
): string[] {
  const out: string[] = [];

  out.push(event.scoringMode === 'points' ? t.rules.scoringPoints : t.rules.scoringTiles);

  if (event.format === 'tilerace') out.push(t.rules.tileRace);

  // Reveal policy is the single most-asked mechanic on a modern board — a player who can't see a
  // tile assumes something is broken rather than that the board is drip-feeding on purpose.
  switch (rules.revealPolicy) {
    case 'scheduled':
      out.push(t.rules.revealScheduled);
      break;
    case 'interval':
      out.push(
        plural(rules.revealBatchSize, t.rules.revealIntervalOne, t.rules.revealIntervalMany, {
          order: rules.revealOrder === 'random' ? t.rules.revealOrderRandom : t.rules.revealOrderBoard,
          minutes: rules.revealIntervalMinutes,
        }),
      );
      break;
    case 'bounty':
      out.push(t.rules.revealBounty);
      break;
    case 'rotating':
      out.push(fmt(t.rules.revealRotating, { n: rules.revealWindowSize }));
      break;
    default:
      if (event.tilesRevealed) out.push(t.rules.revealAll);
  }

  if (!event.tilesRevealed) out.push(t.rules.notRevealed);

  if (rules.lockout && rules.revealPolicy !== 'bounty') out.push(t.rules.lockout);
  if (rules.firstBonus > 0) {
    out.push(fmt(t.rules.firstBonus, { amount: code(`+${rules.firstBonus}`) }));
  }
  if (rules.decay) {
    const { targetPct, hours } = rules.decay;
    out.push(fmt(targetPct < 100 ? t.rules.decay : t.rules.growth, { pct: targetPct, hours }));
  }
  if (rules.mission) {
    const when =
      rules.mission.announceMode === 'interval'
        ? fmt(t.rules.missionWhenInterval, { minutes: rules.mission.intervalMinutes })
        : rules.mission.announceMode === 'scheduled'
          ? t.rules.missionWhenScheduled
          : t.rules.missionWhenManual;
    out.push(fmt(t.rules.missions, { when }));
    // The scoring is the part that gets misread: a mission's points are ON TOP, so a team can end
    // above 100% of the board, and the board total never moves when one is announced.
    const counted =
      missionCounts.total > 0
        ? ` ${fmt(t.rules.missionAnnouncedCount, { announced: missionCounts.announced, total: missionCounts.total })}`
        : '';
    out.push(`${t.rules.missionBonusNote}${counted}`.trimEnd());
  }

  if (rules.startProof) {
    out.push(rules.startProof.onMissing === 'reject' ? t.rules.startProofStrict : t.rules.startProofFlag);
    if (rules.startProof.maxSessionMinutes > 0) {
      out.push(fmt(t.rules.startProofSession, { minutes: rules.startProof.maxSessionMinutes }));
    }
  }

  if (rules.teamChoice) out.push(t.rules.teamChoice);
  else if (rules.captainInvites) out.push(t.rules.captainInvites);

  if (event.playerCount > 0 && fee) out.push(fmt(t.rules.entryFee, { amount: code(formatGp(fee)) }));
  if (pool > 0) out.push(fmt(t.rules.prizePool, { amount: code(formatGp(pool)) }));

  return out;
}

/**
 * How credit actually reaches the board, told from what THIS board contains rather than in general.
 *
 * The question every event gets asked is some version of "I don't run the plugin — am I stuck?",
 * and the honest answer depends on the tiles. Hiscores-backed tiles (boss KC, skilling) need no
 * client at all, only a logout; everything else needs evidence, which the plugin files for you and
 * which you can otherwise upload yourself. Saying that with the board's own numbers in it beats a
 * paragraph of general advice.
 */
function trackingLines(
  t: DiscordDict,
  clan: ClanContext,
  boardTilesOnly: { trackedStat: string | null }[],
): string[] {
  if (boardTilesOnly.length === 0) return [];
  const hiscores = boardTilesOnly.filter((tile) => (tile.trackedStat ?? '').trim().length > 0).length;
  const proof = boardTilesOnly.length - hiscores;

  const out: string[] = ['', t.rules.trackingHeading];
  out.push(t.rules.trackingPlugin);
  if (hiscores > 0) {
    out.push(
      hiscores === boardTilesOnly.length
        ? t.rules.trackingHiscoresAll
        : fmt(t.rules.trackingHiscoresSome, { n: hiscores }),
    );
  }
  if (proof > 0) {
    const where = clan.origin
      ? fmt(t.rules.trackingWhereUrl, { url: clan.origin })
      : t.rules.trackingWhereNoUrl;
    out.push(
      proof === boardTilesOnly.length
        ? fmt(t.rules.trackingProofAll, { where })
        : fmt(t.rules.trackingProofSome, { n: proof, where }),
    );
  }
  out.push(t.rules.trackingKeepShot);
  return out;
}

async function rulesEmbeds(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
): Promise<DiscordEmbed[]> {
  const [row, house, allTiles] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, event.id) }),
    readHouseRules(),
    db
      .select({ id: tiles.id, mission: tiles.mission, revealedAt: tiles.revealedAt, trackedStat: tiles.trackedStat })
      .from(tiles)
      .where(eq(tiles.eventId, event.id)),
  ]);
  const rules = parseEventRules(row?.rules);
  const approved = await countApprovedSignups(event.id).catch(() => 0);
  const pool = computePrizePool({
    addedPrizePool: row?.addedPrizePool ?? null,
    signupFee: row?.signupFee ?? null,
    approvedCount: approved,
  });

  const missionPool = missionTiles(allTiles);
  const missionCounts = {
    total: missionPool.length,
    announced: missionPool.filter((t) => t.revealedAt).length,
  };

  const body = [
    ...mechanicsLines(t, event, rules, pool, row?.signupFee ?? null, missionCounts),
    // Tile names stay hidden on an unrevealed board, but HOW tracking works is not a spoiler.
    ...trackingLines(t, clan, boardTiles(allTiles)),
    '',
    contextLine(clan, event, cross, t),
  ];

  const embeds: DiscordEmbed[] = [
    {
      title: clamp(fmt(t.rules.title, { event: event.name }), LIMIT.title),
      url: eventUrl(clan, event.id),
      description: clamp(body.join('\n'), LIMIT.description),
      color: EMBED_COLOR.gold,
      author: authorOf(clan),
      fields: [field(t.common.fieldFormat, shapeLabel(event)), statField(t.common.fieldTeams, event.teamCount)],
    },
  ];

  // House rules ride in their OWN embed rather than appended to the mechanics: they're a different
  // kind of statement (clan policy, not board configuration) and mixing them makes both skimmable
  // by nobody. Long rulesets get their first section plus a link — Discord's 4096-character cap is
  // not a place to dump a full rules document, and a truncated rule reads as a complete one.
  if (house.text || house.url) {
    const full = house.text ?? '';
    const truncated = full.length > LIMIT.description - 200;
    const shown = truncated ? `${full.slice(0, LIMIT.description - 200).trimEnd()}…` : full;
    const tail = house.url
      ? `\n\n${truncated ? t.rules.houseContinues : t.rules.houseFull} ${house.url}`
      : truncated
        ? `\n\n${t.rules.houseTrimmed}`
        : '';
    embeds.push({
      title: clamp(fmt(t.rules.houseTitle, { clan: clamp(clan.name, 80) }), LIMIT.title),
      description: clamp(`${shown}${tail}`.trim(), LIMIT.description),
      color: EMBED_COLOR.blue,
    });
  }

  return embeds;
}

// ── /bingo me ───────────────────────────────────────────────────────────────────────────────────

/**
 * Everything the invoker did on this board. Contributions come from two places that both mean "this
 * person finished it": a completion credited to them directly (stat tiles, solo count tiles) and an
 * approved submission they were credited on. Counting distinct TILES across both keeps a tile that
 * took four drops from reading as four tiles.
 */
async function meEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
  memberIds: number[],
  who: string,
): Promise<DiscordEmbed> {
  const myPlayers = memberIds.length
    ? await db
        .select({ id: players.id, name: players.name, teamId: players.teamId })
        .from(players)
        .where(and(eq(players.eventId, event.id), inArray(players.clanMemberId, memberIds)))
    : [];

  if (myPlayers.length === 0) {
    const lines = [fmt(t.me.notEntered, { event: clamp(event.name, 100) })];
    if (clan.origin) lines.push(fmt(t.me.notEnteredWhere, { url: clan.origin }));
    lines.push('', contextLine(clan, event, cross, t));
    return {
      title: t.me.notEnteredTitle,
      description: lines.join('\n'),
      color: EMBED_COLOR.blue,
      author: authorOf(clan),
    };
  }

  const playerIds = myPlayers.map((p) => p.id);
  const teamId = myPlayers.find((p) => p.teamId != null)?.teamId ?? null;

  const [team, credited, standings] = await Promise.all([
    teamId ? db.query.teams.findFirst({ where: eq(teams.id, teamId) }) : Promise.resolve(undefined),
    db
      .select({ tileId: completions.tileId, label: tiles.label, at: completions.completedAt })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .where(and(eq(tiles.eventId, event.id), inArray(completions.creditPlayerId, playerIds)))
      .orderBy(desc(completions.completedAt)),
    getTeamStandings(event.id, event.scoringMode),
  ]);

  const rank = teamId ? standings.findIndex((s) => s.teamId === teamId) + 1 : 0;
  const mine = teamId ? standings.find((s) => s.teamId === teamId) : undefined;

  const body: string[] = [];
  if (team) {
    const name = clamp(team.name, 60);
    body.push(
      rank
        ? fmt(t.me.onTeamRanked, { team: name, place: placeMark(rank - 1), total: standings.length })
        : fmt(t.me.onTeam, { team: name }),
    );
  } else {
    body.push(t.me.noTeamYet);
  }
  if (credited.length && !event.tilesRevealed) {
    // Same gate as the team card: an unrevealed board doesn't name its tiles anywhere, so the count
    // stands in for the list. The field below still shows how many they've finished.
    body.push('', plural(credited.length, t.me.finishedHiddenOne, t.me.finishedHiddenMany));
  } else if (credited.length) {
    body.push('', t.me.finishedHeading, ...credited.slice(0, 8).map((c) => `• ${clamp(c.label, 70)}`));
    if (credited.length > 8) body.push(`-# ${fmt(t.common.more, { n: credited.length - 8 })}`);
  } else if (event.phase === 'running') {
    body.push('', t.me.nothingYet);
  }
  body.push('', contextLine(clan, event, cross, t));

  const accountNote =
    myPlayers.length > 1
      ? [field(t.common.fieldAccounts, myPlayers.map((p) => p.name).join(', '), false)]
      : [];

  return {
    title: clamp(fmt(t.me.title, { who, event: event.name }), LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: team ? teamColorToDecimal(team.color) : EMBED_COLOR.blue,
    author: authorOf(clan),
    fields: [
      ...(mine ? [statField(t.common.fieldTeamScore, `${mine.score} ${mine.unit}`)] : []),
      statField(t.common.fieldYourTiles, credited.length),
      ...accountNote,
    ],
  };
}

// ── /bingo team ─────────────────────────────────────────────────────────────────────────────────

async function teamEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
  wanted: string | null,
  fallbackTeamId: number | null,
): Promise<DiscordEmbed> {
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, event.id));
  if (eventTeams.length === 0) {
    return {
      title: t.team.noTeamsTitle,
      description: `${fmt(t.team.noTeamsBody, { event: clamp(event.name, 100) })}\n\n${contextLine(clan, event, cross, t)}`,
      color: EMBED_COLOR.blue,
      author: authorOf(clan),
    };
  }

  const needle = wanted?.trim().toLowerCase() ?? '';
  const team = needle
    ? (eventTeams.find((t) => t.name.toLowerCase() === needle) ??
      eventTeams.find((t) => t.name.toLowerCase().includes(needle)))
    : (eventTeams.find((t) => t.id === fallbackTeamId) ?? undefined);

  if (!team) {
    return {
      title: t.team.noMatchTitle,
      description: [
        needle
          ? fmt(t.team.noMatch, { event: clamp(event.name, 80), needle: clamp(wanted ?? '', 40) })
          : t.team.noneOfYours,
        '',
        fmt(t.team.teamsList, { names: eventTeams.map((row) => clamp(row.name, 30)).join(' · ') }),
        '',
        contextLine(clan, event, cross, t),
      ].join('\n'),
      color: EMBED_COLOR.amber,
      author: authorOf(clan),
    };
  }

  const [standings, roster, recent] = await Promise.all([
    getTeamStandings(event.id, event.scoringMode),
    db
      .select({ name: players.name, source: clanMembers.source })
      .from(players)
      .leftJoin(clanMembers, eq(players.clanMemberId, clanMembers.id))
      .where(eq(players.teamId, team.id)),
    db
      .select({ label: tiles.label, at: completions.completedAt })
      .from(completions)
      .innerJoin(tiles, eq(completions.tileId, tiles.id))
      .where(eq(completions.teamId, team.id))
      .orderBy(desc(completions.completedAt))
      .limit(5),
  ]);

  const standing = standings.find((s) => s.teamId === team.id);
  const rank = standings.findIndex((s) => s.teamId === team.id) + 1;

  const body: string[] = [];
  if (standing) {
    const bonus = standing.bonusScore > 0 ? fmt(t.team.bonusSuffix, { n: standing.bonusScore }) : '';
    body.push(
      fmt(t.team.standing, {
        place: placeMark(rank - 1),
        total: standings.length,
        score: code(`${standing.score} ${standing.unit}`),
        bonus,
        pct: standing.pct,
      }),
    );
  }
  // Name visiting members individually here: on a team card the roster is short enough that "who is
  // actually from another clan" is the useful answer, where the leaderboard only has room for a mark.
  const visitors = roster.filter((r) => r.source === 'federation');
  if (visitors.length) {
    const names = visitors.map((v) => clamp(v.name, 20)).join(', ');
    body.push(
      '',
      visitors.length === roster.length
        ? fmt(t.team.visitingWholeTeam, { names })
        : plural(visitors.length, t.team.visitingSomeOne, t.team.visitingSomeMany, { names }),
    );
  }
  if (recent.length) {
    body.push('', t.team.recentHeading, ...recent.map((r) => `• ${clamp(r.label, 70)}`));
  }
  body.push('', contextLine(clan, event, cross, t));

  return {
    title: clamp(fmt(t.team.title, { team: team.name }), LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: teamColorToDecimal(team.color),
    author: authorOf(clan),
    fields: [
      statField(t.common.fieldRank, rank ? `#${rank}` : '—'),
      statField(t.common.fieldRoster, roster.length),
      ...(standing ? [statField(t.common.fieldScore, `${standing.score} ${standing.unit}`)] : []),
    ],
  };
}

// ── /bingo apply ────────────────────────────────────────────────────────────────────────────────

/**
 * How someone gets into the event, and where they already stand.
 *
 * "Can I still sign up?" has four different answers depending on the clock — not open yet, open,
 * closed, event already started — and they're the four states lib/signup.signupWindowState already
 * distinguishes. Reusing it means Discord and the web sign-up page can't disagree about whether the
 * door is open, which they would within a week of me re-deriving it here.
 */
async function applyEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
  memberIds: number[],
): Promise<DiscordEmbed> {
  const row = await db.query.events.findFirst({ where: eq(events.id, event.id) });
  const window = signupWindowState({
    signupOpensAt: row?.signupOpensAt ?? null,
    signupDeadline: row?.signupDeadline ?? null,
    startDate: row?.startDate ?? null,
  });

  // Where THEY stand comes first: someone already approved doesn't need the sign-up pitch.
  const mine = memberIds.length
    ? await db
        .select({ status: eventSignups.status })
        .from(eventSignups)
        .where(and(eq(eventSignups.eventId, event.id), inArray(eventSignups.clanMemberId, memberIds)))
    : [];
  const already = mine[0]?.status ?? null;
  const onTeam = memberIds.length ? await myTeamId(event.id, memberIds) : null;

  const body: string[] = [];
  if (onTeam) {
    body.push(t.apply.drafted);
  } else if (already === 'approved') {
    body.push(t.apply.approved);
  } else if (already === 'pending') {
    body.push(t.apply.pending);
  } else if (window.open) {
    body.push(t.apply.open);
  } else {
    body.push(
      window.reason === 'not_open_yet'
        ? t.apply.notOpenYet
        : window.reason === 'event_started'
          ? t.apply.eventStarted
          : t.apply.closed,
    );
  }

  // Only pitch the door when it's actually open and they aren't already through it.
  if (!already && !onTeam && window.open) {
    const deadline = relativeTs(row?.signupDeadline ?? null);
    if (deadline) body.push(fmt(t.apply.closesIn, { when: deadline }));
    if (row?.signupFee) {
      body.push(
        fmt(row.feeMode === 'per-account' ? t.apply.feePerAccount : t.apply.fee, {
          amount: code(formatGp(row.signupFee)),
        }),
      );
    }
    if (clan.origin) body.push('', fmt(t.apply.signUpAt, { url: `${clan.origin}/events/${event.id}` }));
  } else if (!already && !onTeam && window.reason === 'not_open_yet') {
    const opens = relativeTs(row?.signupOpensAt ?? null);
    if (opens) body.push(fmt(t.apply.opensIn, { when: opens }));
  }

  // The roster gate is the thing that surprises people: signing up needs an account Anvil knows.
  if (memberIds.length === 0) {
    body.push(
      '',
      clan.origin ? fmt(t.apply.noAccountUrl, { url: clan.origin }) : t.apply.noAccountNoUrl,
    );
  }

  body.push('', contextLine(clan, event, cross, t));

  return {
    title: clamp(fmt(t.apply.title, { event: event.name }), LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: onTeam || already === 'approved' ? EMBED_COLOR.green : window.open ? EMBED_COLOR.gold : EMBED_COLOR.blue,
    author: authorOf(clan),
  };
}

// ── /bingo next ─────────────────────────────────────────────────────────────────────────────────

/**
 * The next thing on the clock. On a drip-feed board that's the next draw; on a board with missions
 * it may be the next mission; otherwise it's the start or the end. Everything here is a Discord
 * relative timestamp, so it ticks by itself in whatever timezone the reader is in — the one thing a
 * static "in about 3 hours" can never do.
 */
async function nextEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
): Promise<DiscordEmbed> {
  const [row, allTiles] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, event.id) }),
    db
      .select({ id: tiles.id, mission: tiles.mission, revealAt: tiles.revealAt, revealedAt: tiles.revealedAt, closedAt: tiles.closedAt })
      .from(tiles)
      .where(eq(tiles.eventId, event.id)),
  ]);
  const rules = parseEventRules(row?.rules);

  const upcoming: { what: string; at: string }[] = [];
  if (event.phase === 'upcoming' && row?.startDate) upcoming.push({ what: t.next.eventStarts, at: row.startDate });
  if (event.phase === 'running' && row?.endDate) upcoming.push({ what: t.next.eventEnds, at: row.endDate });

  const reveal = nextRevealAt({ startDate: row?.startDate ?? null, rules: row?.rules }, rules, allTiles);
  if (reveal) upcoming.push({ what: t.next.nextTile, at: reveal });

  const mission = nextMissionAt({ startDate: row?.startDate ?? null }, rules, allTiles);
  if (mission) upcoming.push({ what: t.next.nextMission, at: mission });

  if (row?.signupDeadline && event.phase === 'upcoming') {
    upcoming.push({ what: t.next.signupsClose, at: row.signupDeadline });
  }

  const body: string[] = [];
  if (upcoming.length === 0) {
    body.push(event.phase === 'ended' ? t.next.nothingEnded : t.next.nothingScheduled);
  } else {
    // Soonest first: "what's next" is a question about the top of this list.
    body.push(
      ...upcoming
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
        .map((u) => `${u.what} — ${relativeTs(u.at)}`),
    );
  }

  // A mission pool that still has entries is worth saying even when its timing is staff's call.
  const hiddenMissions = missionTiles(allTiles).filter((t) => !t.revealedAt).length;
  if (hiddenMissions > 0 && !mission) {
    body.push('', plural(hiddenMissions, t.next.hiddenMissionsOne, t.next.hiddenMissionsMany));
  }

  body.push('', contextLine(clan, event, cross, t));

  return {
    title: clamp(fmt(t.next.title, { event: event.name }), LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: EMBED_COLOR.blue,
    author: authorOf(clan),
  };
}

// ── /bingo help ─────────────────────────────────────────────────────────────────────────────────

/**
 * What the bot can answer. Built from SUBCOMMAND_NAMES and the registered descriptions rather than a
 * hand-written list, so a command added to the tree can't be missing from its own help.
 */
function helpEmbed(
  t: DiscordDict,
  clan: ClanContext,
  event: EventContext | null,
  cross: CrossClanContext,
): DiscordEmbed {
  const body = [
    // The command NAMES come from the registered tree so help can't list one that doesn't exist;
    // the blurbs come from the dictionary so they're in the reader's language.
    ...SUBCOMMAND_ORDER.map(
      (name) => `${code(`/${COMMAND_NAME} ${name}`)} — ${t.help.subs[name as keyof typeof t.help.subs] ?? ''}`,
    ),
    '',
    fmt(t.help.privateNote, { share: t.common.shareButton }),
    '',
    contextLine(clan, event, cross, t),
  ];
  return {
    title: t.help.title,
    description: clamp(body.join('\n'), LIMIT.description),
    color: EMBED_COLOR.gold,
    author: authorOf(clan),
  };
}

// ── Dispatcher ──────────────────────────────────────────────────────────────────────────────────

/** The team the invoker plays for on this event, if any — the default subject of `/bingo team`. */
async function myTeamId(eventId: number, memberIds: number[]): Promise<number | null> {
  if (memberIds.length === 0) return null;
  const rows = await db
    .select({ teamId: players.teamId })
    .from(players)
    .where(and(eq(players.eventId, eventId), inArray(players.clanMemberId, memberIds)));
  return rows.find((r) => r.teamId != null)?.teamId ?? null;
}

/** Everything a subcommand needs, resolved once by the dispatcher rather than per handler. */
interface CommandContext {
  t: DiscordDict;
  clan: ClanContext;
  event: EventContext;
  cross: CrossClanContext;
  /** The invoker's linked roster rows on this instance. Empty = they're not on the roster. */
  memberIds: number[];
  /** Their display name, for prose. */
  who: string;
  options: Record<string, string | number | boolean>;
}

/**
 * What a subcommand produces: embeds, or one sentence when there's nothing to draw.
 *
 * Handlers deliberately don't build the response envelope. Ephemerality, the share button and the
 * "shared by" line are decided identically for every command, and a handler that assembled its own
 * would be the one that eventually forgets the button.
 */
type SubResult = { embeds: DiscordEmbed[] } | { text: string };

/**
 * The subcommands, as a lookup rather than a switch — so the set Discord advertises
 * (COMMAND_DEFINITIONS) and the set the server answers are the same list of strings, checkable by a
 * test. A command that autocompletes and then fails in front of a member is worse than one that
 * never existed.
 */
const SUBCOMMANDS: Record<string, (ctx: CommandContext) => Promise<SubResult>> = {
  async board({ t, clan, event, cross }) {
    return { embeds: [await boardEmbed(t, clan, event, cross)] };
  },

  async rules({ t, clan, event, cross }) {
    return { embeds: await rulesEmbeds(t, clan, event, cross) };
  },

  async leaderboard({ t, clan, event, cross, memberIds }) {
    const teamId = await myTeamId(event.id, memberIds);
    return { embeds: [await leaderboardEmbed(t, clan, event, cross, teamId)] };
  },

  async apply({ t, clan, event, cross, memberIds }) {
    return { embeds: [await applyEmbed(t, clan, event, cross, memberIds)] };
  },

  async next({ t, clan, event, cross }) {
    return { embeds: [await nextEmbed(t, clan, event, cross)] };
  },

  async help({ t, clan, event, cross }) {
    return { embeds: [helpEmbed(t, clan, event, cross)] };
  },

  async me({ t, clan, event, cross, memberIds, who }) {
    return { embeds: [await meEmbed(t, clan, event, cross, memberIds, who)] };
  },

  async team({ t, clan, event, cross, memberIds, options }) {
    // Hidden boards stay hidden. Staff see them on the web; Discord is a member-facing surface with
    // no way to prove a staff role, so it shows what a member would see.
    if (!event.tilesRevealed) return { text: fmt(t.team.hiddenBoard, { event: event.name }) };
    const wanted = typeof options.name === 'string' ? options.name : null;
    const fallback = await myTeamId(event.id, memberIds);
    return { embeds: [await teamEmbed(t, clan, event, cross, wanted, fallback)] };
  },
};

/** The subcommands this server answers. Asserted against COMMAND_DEFINITIONS in the tests. */
export const SUBCOMMAND_NAMES = Object.keys(SUBCOMMANDS);

// ── Share ───────────────────────────────────────────────────────────────────────────────────────
//
// The button carries everything needed to rebuild the answer, because there is nothing else to
// carry it in: Discord gives a component interaction the custom_id and nothing more, and holding
// server-side state keyed by message id would mean a share that stops working after a redeploy.
// Rebuilding also means a leaderboard shared ten minutes later shows the standings as they are NOW,
// which is what a channel reading it would assume anyway.

const SHARE_PREFIX = 'share:';

/** `share:team:Reds`. Discord caps custom_id at 100 characters, so the argument is clamped. */
export function shareId(sub: string, options: Record<string, string | number | boolean>): string {
  const arg = typeof options.name === 'string' ? options.name.trim() : '';
  return arg ? `${SHARE_PREFIX}${sub}:${arg.slice(0, 80)}` : `${SHARE_PREFIX}${sub}`;
}

/** The inverse. Splits on the first two colons only — a team name may contain its own. */
export function parseShareId(customId: string): { sub: string; options: Record<string, string> } | null {
  if (!customId.startsWith(SHARE_PREFIX)) return null;
  const rest = customId.slice(SHARE_PREFIX.length);
  const cut = rest.indexOf(':');
  if (cut === -1) return { sub: rest, options: {} };
  return { sub: rest.slice(0, cut), options: { name: rest.slice(cut + 1) } };
}

/**
 * Turn a subcommand result into a reply.
 *
 * Private answers get the share button; a shared one doesn't (it is already in the channel, and a
 * second button would just invite a duplicate). A `text` result never gets one either — "no teams
 * yet" is not worth a channel post.
 */
function reply(result: SubResult, opts: { t: DiscordDict; ephemeral: boolean; shareId?: string; sharedBy?: string }): InteractionResponse {
  if ('text' in result) return textReply(result.text, { ephemeral: opts.ephemeral });
  const response = embedReply(result.embeds, {
    ephemeral: opts.ephemeral,
    components: opts.shareId ? [shareRow(opts.t.common.shareButton, opts.shareId)] : undefined,
  });
  if (opts.sharedBy && response.data) {
    response.data.content = fmt(opts.t.common.sharedBy, { who: opts.sharedBy });
  }
  return response;
}

// ── Entry points ────────────────────────────────────────────────────────────────────────────────

/** Clan, board and identity — everything both entry points resolve the same way. */
async function resolveContext(
  interaction: Interaction,
  locale: string,
): Promise<
  | { ok: true; ctx: Omit<CommandContext, 'options'> }
  | { ok: false; response: InteractionResponse }
> {
  const t = await getDiscordDict(locale);
  const clan = await getClanContext();

  // The clan's chosen language, when it has one, overrides whatever Discord detected.
  const t2 = clan.language ? await getDiscordDict(resolveLocale(null, clan.language)) : t;

  // 1. WHICH CLAN — refuse anything that isn't this instance's own server (see discordContext).
  const guildCheck = checkGuild(clan, interaction.guild_id);
  if (guildCheck === 'dm') return { ok: false, response: textReply(t2.errors.dm) };
  if (guildCheck === 'wrong-guild') {
    return { ok: false, response: textReply(fmt(t2.errors.wrongGuild, { clan: clan.name })) };
  }

  // 2. WHICH BOARD.
  const event = await pickEvent();
  if (!event) {
    const where = clan.origin ? ` ${fmt(t2.errors.noBoardsStaff, { url: clan.origin })}` : '';
    return { ok: false, response: textReply(`${fmt(t2.errors.noBoards, { clan: clan.name })}${where}`) };
  }

  // 3. WHO ELSE IS IN IT, and who is asking.
  const cross = await getCrossClanContext(event.id);
  const discordId = invokerId(interaction);
  const identity = discordId ? await resolveInvoker(discordId) : null;

  return {
    ok: true,
    ctx: {
      t: t2,
      clan,
      event,
      cross,
      memberIds: identity?.memberIds ?? [],
      who: invokerName(interaction),
    },
  };
}

/**
 * Turn a verified slash command into a reply.
 *
 * Never throws: an unhandled error here becomes a Discord timeout, which shows the member "the
 * application did not respond" and tells them nothing. Every failure path answers in words.
 */
export async function handleCommand(interaction: Interaction): Promise<InteractionResponse> {
  // A private answer speaks the member's own language — nobody else is reading it.
  const locale = resolveLocale(interaction.locale);
  const t = await getDiscordDict(locale);

  // Anvil registers exactly one command tree; anything else reaching this endpoint is a stale
  // registration from an older deploy that the dispatcher can no longer answer.
  if (interaction.data?.name !== COMMAND_NAME) {
    return textReply(
      fmt(t.errors.unknownCommand, {
        command: code(`/${interaction.data?.name ?? '?'}`),
        suggestion: code(`/${COMMAND_NAME} board`),
      }),
    );
  }

  const { sub, options } = readSubcommand(interaction);
  const handler = sub ? SUBCOMMANDS[sub] : undefined;
  if (!handler) {
    return textReply(
      fmt(t.errors.unknownSub, {
        list: SUBCOMMAND_NAMES.map((n) => code(`/${COMMAND_NAME} ${n}`)).join(', '),
      }),
    );
  }

  const resolved = await resolveContext(interaction, locale);
  if (!resolved.ok) return resolved.response;

  const result = await handler({ ...resolved.ctx, options });
  return reply(result, { t: resolved.ctx.t, ephemeral: true, shareId: shareId(sub!, options) });
}

/**
 * The Share button: the same answer, rebuilt and posted to the channel.
 *
 * In the SERVER's language, not the sharer's — a channel post is read by everyone in it, and
 * putting Swedish in front of an English-speaking clan because Sven pressed a button is a worse
 * outcome than Sven reading English for one message.
 */
export async function handleComponent(interaction: Interaction): Promise<InteractionResponse> {
  const locale = resolveLocale(interaction.guild_locale ?? interaction.locale);
  const t = await getDiscordDict(locale);

  const parsed = parseShareId(interaction.data?.custom_id ?? '');
  const handler = parsed ? SUBCOMMANDS[parsed.sub] : undefined;
  if (!parsed || !handler) return textReply(t.errors.shareExpired);

  const resolved = await resolveContext(interaction, locale);
  if (!resolved.ok) return resolved.response;

  const result = await handler({ ...resolved.ctx, options: parsed.options });
  return reply(result, {
    t: resolved.ctx.t,
    ephemeral: false,
    sharedBy: invokerName(interaction),
  });
}
