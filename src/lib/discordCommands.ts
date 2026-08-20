// What the slash commands actually answer.
//
// lib/discordInteractions owns the protocol (signatures, payload shapes, response envelopes) and
// lib/discordContext owns "which clan, which board, who else is in it". This module is the part a
// clan actually experiences: four read-only commands that put the board in the chat window.
//
// Design rules, learned from the notification embeds:
//   - Every answer is EPHEMERAL by default. Someone checking their own standing shouldn't spam the
//     channel; `/bingo leaderboard share:true` opts into a visible post.
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
import { COMMAND_DEFINITIONS, COMMAND_NAME } from '@/lib/discordCommandDefs';
import {
  embedReply,
  textReply,
  invokerId,
  invokerName,
  readSubcommand,
  type Interaction,
  type InteractionResponse,
} from '@/lib/discordInteractions';

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
function standingsBody(standings: TeamStanding[], cross: CrossClanContext, highlightTeamId?: number | null): string {
  if (standings.length === 0) return '_No teams yet._';
  const lines = standings.slice(0, 15).map((s, i) => {
    const visiting = cross.visitingTeamIds.has(s.teamId) ? ' 🤝' : '';
    const mine = highlightTeamId === s.teamId ? ' ←' : '';
    // The percentage is BOARD progress, so a team carrying mission bonus shows a score ahead of its
    // percentage. Naming the bonus is what stops that reading as a bug.
    const bonus = s.bonusScore > 0 ? ` ⚡+${s.bonusScore}` : '';
    return `${placeMark(i)} **${clamp(s.name, 60)}**${visiting} — ${code(`${s.score} ${s.unit}`)}${bonus} · ${s.pct}%${mine}`;
  });
  if (standings.length > 15) lines.push(`-# +${standings.length - 15} more on the site`);
  return lines.join('\n');
}

/** The legend for the ⚡ marker, only when a mission has actually scored for someone. */
function bonusNote(standings: TeamStanding[]): string | null {
  if (!standings.some((s) => s.bonusScore > 0)) return null;
  return '⚡ mission bonus — earned on top of the board total, so it counts toward the score but not the percentage.';
}

/** The legend for the 🤝 marker, only when something actually carries it. */
function crossClanNote(cross: CrossClanContext): string | null {
  if (!cross.shared) return null;
  if (cross.visitingTeamNames.length) {
    return `🤝 ${cross.visitingTeamNames.map((n) => `**${clamp(n, 40)}**`).join(', ')} ${cross.visitingTeamNames.length === 1 ? 'is a visiting clan' : 'are visiting clans'} — this board is shared.`;
  }
  return `🤝 ${cross.visitingPlayers} player${cross.visitingPlayers === 1 ? '' : 's'} ${cross.visitingPlayers === 1 ? 'is' : 'are'} visiting from other clans.`;
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

async function boardEmbed(clan: ClanContext, event: EventContext, cross: CrossClanContext): Promise<DiscordEmbed> {
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
  if (event.phase === 'upcoming' && when) body.push(`Starts ${when}.`);
  else if (event.phase === 'running' && when) body.push(`Ends ${when}.`);
  else if (event.phase === 'ended') body.push('This board has finished.');
  else if (event.phase === 'draft') body.push('Not scheduled yet.');

  if (!event.tilesRevealed) body.push('Tiles are still hidden — the board reveals when staff open it.');
  if (standings.length) body.push('', standingsBody(standings, cross));
  const bonus = bonusNote(standings);
  if (bonus) body.push('', `-# ${bonus}`);
  const note = crossClanNote(cross);
  if (note) body.push('', note);
  body.push('', contextLine(clan, event, cross));

  return {
    title: clamp(`📋 ${event.name}`, LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: event.phase === 'running' ? EMBED_COLOR.green : event.phase === 'ended' ? EMBED_COLOR.blue : EMBED_COLOR.gold,
    author: authorOf(clan),
    fields: [
      field('Format', shapeLabel(event)),
      statField('Teams', event.teamCount),
      statField('Players', event.playerCount),
      // Tile progress is meaningless before a reveal, and stating it would leak the board's size.
      ...(event.tilesRevealed ? [statField('Tiles done', `${distinctDone}/${countable.length}`)] : []),
    ],
  };
}

// ── /bingo leaderboard ──────────────────────────────────────────────────────────────────────────

async function leaderboardEmbed(
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
  myTeamId: number | null,
): Promise<DiscordEmbed> {
  const standings = await getTeamStandings(event.id, event.scoringMode);
  const body: string[] = [standingsBody(standings, cross, myTeamId)];
  const bonus = bonusNote(standings);
  if (bonus) body.push('', `-# ${bonus}`);
  const note = crossClanNote(cross);
  if (note) body.push('', note);
  body.push('', contextLine(clan, event, cross));

  const leader = standings[0];
  return {
    title: clamp(`🏆 ${event.name} — standings`, LIMIT.title),
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
  event: EventContext,
  rules: EventRules,
  pool: number,
  fee: number | null,
  missionCounts: { total: number; announced: number },
): string[] {
  const out: string[] = [];

  out.push(
    event.scoringMode === 'points'
      ? '• **Scoring** — each tile is worth its own points; a team\'s score is the sum of what it finished.'
      : '• **Scoring** — one point per tile; a team\'s score is how many it finished.',
  );

  if (event.format === 'tilerace') {
    out.push('• **Tile race** — the board is an ordered track. You advance along it; your furthest tile is your position.');
  }

  // Reveal policy is the single most-asked mechanic on a modern board — a player who can't see a
  // tile assumes something is broken rather than that the board is drip-feeding on purpose.
  switch (rules.revealPolicy) {
    case 'scheduled':
      out.push('• **Reveals** — tiles open on a schedule set by staff. A tile you can\'t see yet simply hasn\'t opened.');
      break;
    case 'interval':
      out.push(
        `• **Reveals** — ${rules.revealBatchSize === 1 ? 'a tile is' : `${rules.revealBatchSize} tiles are`} drawn ${rules.revealOrder === 'random' ? 'at random' : 'in board order'} every ${rules.revealIntervalMinutes} minutes.`,
      );
      break;
    case 'bounty':
      out.push('• **Bounty** — exactly one tile is open at a time. The first team to finish it closes it and the next is drawn.');
      break;
    case 'rotating':
      out.push(
        `• **Rotating** — ${rules.revealWindowSize} tiles stay open at once; older ones expire as new ones draw. Finish them while they're up.`,
      );
      break;
    default:
      if (event.tilesRevealed) out.push('• **Reveals** — the whole board is open from the start.');
  }

  if (!event.tilesRevealed) {
    out.push('• **Not revealed yet** — staff open the board when the event starts. Nobody can see the tiles before then.');
  }

  if (rules.lockout && rules.revealPolicy !== 'bounty') {
    out.push('• **Lockout** — the first team to finish a tile takes it. Nobody else can score it after that.');
  }
  if (rules.firstBonus > 0) {
    out.push(`• **First-finish bonus** — the first team on a tile earns ${code(`+${rules.firstBonus}`)} extra points.`);
  }
  if (rules.decay) {
    const { targetPct, hours } = rules.decay;
    out.push(
      targetPct < 100
        ? `• **Decay** — a tile is worth full points when it opens and slides to ${targetPct}% over ${hours}h. Early finishes score more.`
        : `• **Growth** — a tile starts at full value and climbs to ${targetPct}% over ${hours}h. Waiting scores more.`,
    );
  }
  if (rules.mission) {
    const when =
      rules.mission.announceMode === 'interval'
        ? `every ${rules.mission.intervalMinutes} minutes`
        : rules.mission.announceMode === 'scheduled'
          ? 'on a schedule'
          : 'when staff drop them';
    out.push(`• **Missions** — extra objectives revealed mid-event, ${when}. Nobody sees one before it's announced.`);
    // The scoring is the part that gets misread: a mission's points are ON TOP, so a team can end
    // above 100% of the board, and the board total never moves when one is announced.
    out.push(
      `-# Mission points are a **bonus** — added to your score but never to the board total, so the board can't get longer mid-event. ${missionCounts.total > 0 ? `${missionCounts.announced} of ${missionCounts.total} announced so far.` : ''}`.trimEnd(),
    );
  }

  if (rules.startProof) {
    const strict = rules.startProof.onMissing === 'reject';
    out.push(
      `• **Starting shot** — every player files one screenshot after the start, at a location drawn at the start moment. ${strict ? 'Until you file yours, submissions are refused.' : 'Until you file yours, anything you submit is flagged for review.'}`,
    );
    if (rules.startProof.maxSessionMinutes > 0) {
      out.push(
        `-# Log out and back in first — hiscores only save on logout, so your shot must be within ${rules.startProof.maxSessionMinutes} minutes of a fresh login.`,
      );
    }
  }

  if (rules.teamChoice) out.push('• **Teams** — you pick your team when you sign up; staff approve it.');
  else if (rules.captainInvites) out.push('• **Teams** — captains hand out invite links for their own side.');

  if (event.playerCount > 0 && fee) {
    out.push(`• **Entry fee** — ${code(formatGp(fee))} per entry.`);
  }
  if (pool > 0) {
    out.push(`• **Prize pool** — ${code(formatGp(pool))} and rising with each approved entry.`);
  }

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
function trackingLines(clan: ClanContext, event: EventContext, boardTilesOnly: { trackedStat: string | null }[]): string[] {
  if (boardTilesOnly.length === 0) return [];
  const hiscores = boardTilesOnly.filter((t) => (t.trackedStat ?? '').trim().length > 0).length;
  const proof = boardTilesOnly.length - hiscores;

  const out: string[] = ['', '**Getting credit**'];
  out.push('• **With the Anvil plugin** — it submits for you. Nothing to do but play.');
  if (hiscores > 0) {
    out.push(
      `• **No plugin?** ${hiscores === boardTilesOnly.length ? 'Every tile here' : `${hiscores} of these tiles`} read from the **official hiscores**, so they need no client at all — but hiscores only save when you **log out**, and refresh on the hour. Play → log out → wait for the hour.`,
    );
  }
  if (proof > 0) {
    out.push(
      `• **Drops, kills and timed tasks** need evidence — ${proof === boardTilesOnly.length ? 'every tile here' : `${proof} of these`}. The plugin files it automatically; without it, upload a screenshot yourself${clan.origin ? ` on **My Team** at ${clan.origin}/team` : ' on the My Team page'}.`,
    );
  }
  out.push('-# Keep your own screenshot of anything big either way — it costs nothing and settles any dispute.');
  return out;
}

async function rulesEmbeds(clan: ClanContext, event: EventContext, cross: CrossClanContext): Promise<DiscordEmbed[]> {
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
    ...mechanicsLines(event, rules, pool, row?.signupFee ?? null, missionCounts),
    // Tile names stay hidden on an unrevealed board, but HOW tracking works is not a spoiler.
    ...trackingLines(clan, event, boardTiles(allTiles)),
    '',
    contextLine(clan, event, cross),
  ];

  const embeds: DiscordEmbed[] = [
    {
      title: clamp(`📜 ${event.name} — how it works`, LIMIT.title),
      url: eventUrl(clan, event.id),
      description: clamp(body.join('\n'), LIMIT.description),
      color: EMBED_COLOR.gold,
      author: authorOf(clan),
      fields: [field('Format', shapeLabel(event)), statField('Teams', event.teamCount)],
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
      ? `\n\n${truncated ? '**The rules continue** — read them all at' : 'Full rules:'} ${house.url}`
      : truncated
        ? '\n\n-# Trimmed to fit Discord — ask staff for the full ruleset.'
        : '';
    embeds.push({
      title: `📌 ${clamp(clan.name, 80)} — house rules`,
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
    const lines = [`You aren't entered in **${clamp(event.name, 100)}**.`];
    if (clan.origin) lines.push(`Sign-ups and your profile live at ${clan.origin}.`);
    lines.push('', contextLine(clan, event, cross));
    return {
      title: '🔍 Not on this board',
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
    body.push(
      `You're on **${clamp(team.name, 60)}**${rank ? ` — ${placeMark(rank - 1)} of ${standings.length}` : ''}.`,
    );
  } else {
    body.push(`You're entered but not on a team yet.`);
  }
  if (credited.length && !event.tilesRevealed) {
    // Same gate as the team card: an unrevealed board doesn't name its tiles anywhere, so the count
    // stands in for the list. The field below still shows how many they've finished.
    body.push('', `You've finished ${credited.length} tile${credited.length === 1 ? '' : 's'} — names show once the board is revealed.`);
  } else if (credited.length) {
    body.push('', '**Tiles you finished**', ...credited.slice(0, 8).map((c) => `• ${clamp(c.label, 70)}`));
    if (credited.length > 8) body.push(`-# +${credited.length - 8} more`);
  } else if (event.phase === 'running') {
    body.push('', 'No tiles credited to you yet.');
  }
  body.push('', contextLine(clan, event, cross));

  const accountNote =
    myPlayers.length > 1 ? [field('Accounts', myPlayers.map((p) => p.name).join(', '), false)] : [];

  return {
    title: clamp(`👤 ${who} — ${event.name}`, LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: team ? teamColorToDecimal(team.color) : EMBED_COLOR.blue,
    author: authorOf(clan),
    fields: [
      ...(mine ? [statField('Team score', `${mine.score} ${mine.unit}`)] : []),
      statField('Your tiles', credited.length),
      ...accountNote,
    ],
  };
}

// ── /bingo team ─────────────────────────────────────────────────────────────────────────────────

async function teamEmbed(
  clan: ClanContext,
  event: EventContext,
  cross: CrossClanContext,
  wanted: string | null,
  fallbackTeamId: number | null,
): Promise<DiscordEmbed> {
  const eventTeams = await db.select().from(teams).where(eq(teams.eventId, event.id));
  if (eventTeams.length === 0) {
    return {
      title: '🔍 No teams yet',
      description: `**${clamp(event.name, 100)}** has no teams on it yet.\n\n${contextLine(clan, event, cross)}`,
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
      title: '🔍 No such team',
      description: [
        needle
          ? `No team on **${clamp(event.name, 80)}** matches "${clamp(wanted ?? '', 40)}".`
          : `You're not on a team — name one to look it up.`,
        '',
        `**Teams:** ${eventTeams.map((t) => clamp(t.name, 30)).join(' · ')}`,
        '',
        contextLine(clan, event, cross),
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
    const bonus = standing.bonusScore > 0 ? ` (⚡+${standing.bonusScore} mission bonus)` : '';
    body.push(
      `${placeMark(rank - 1)} of ${standings.length} — ${code(`${standing.score} ${standing.unit}`)}${bonus} · ${standing.pct}% of the board.`,
    );
  }
  // Name visiting members individually here: on a team card the roster is short enough that "who is
  // actually from another clan" is the useful answer, where the leaderboard only has room for a mark.
  const visitors = roster.filter((r) => r.source === 'federation');
  if (visitors.length) {
    body.push(
      '',
      `🤝 ${visitors.length === roster.length ? 'A visiting clan' : `${visitors.length} visiting ${visitors.length === 1 ? 'player' : 'players'}`}: ${visitors.map((v) => clamp(v.name, 20)).join(', ')}`,
    );
  }
  if (recent.length) {
    body.push('', '**Recent tiles**', ...recent.map((r) => `• ${clamp(r.label, 70)}`));
  }
  body.push('', contextLine(clan, event, cross));

  return {
    title: clamp(`🛡️ ${team.name}`, LIMIT.title),
    url: eventUrl(clan, event.id),
    description: clamp(body.join('\n'), LIMIT.description),
    color: teamColorToDecimal(team.color),
    author: authorOf(clan),
    fields: [
      statField('Rank', rank ? `#${rank}` : '—'),
      statField('Roster', roster.length),
      ...(standing ? [statField('Score', `${standing.score} ${standing.unit}`)] : []),
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
    body.push("**You're in** — already drafted onto a team. Nothing left to do but play.");
  } else if (already === 'approved') {
    body.push("**You're signed up and approved.** You'll be placed on a team before the event starts.");
  } else if (already === 'pending') {
    body.push('**Your sign-up is in** and waiting on staff to approve it. Nothing more to do.');
  } else if (window.open) {
    body.push('**Sign-ups are open.**');
  } else {
    body.push(
      window.reason === 'not_open_yet'
        ? "**Sign-ups haven't opened yet.**"
        : window.reason === 'event_started'
          ? '**The event has started**, so sign-ups are closed. Ask staff if there is still room.'
          : '**Sign-ups are closed.**',
    );
  }

  // Only pitch the door when it's actually open and they aren't already through it.
  if (!already && !onTeam && window.open) {
    const deadline = relativeTs(row?.signupDeadline ?? null);
    if (deadline) body.push(`They close ${deadline}.`);
    if (row?.signupFee) {
      body.push(
        `Entry is ${code(formatGp(row.signupFee))}${row.feeMode === 'per-account' ? ' per account' : ''} — staff will tell you where to send it.`,
      );
    }
    if (clan.origin) body.push('', `**Sign up:** ${clan.origin}/events/${event.id}`);
  } else if (!already && !onTeam && window.reason === 'not_open_yet') {
    const opens = relativeTs(row?.signupOpensAt ?? null);
    if (opens) body.push(`They open ${opens}.`);
  }

  // The roster gate is the thing that surprises people: signing up needs an account Anvil knows.
  if (memberIds.length === 0) {
    body.push(
      '',
      `-# Anvil doesn't know your account yet. Link your RSN first${clan.origin ? ` at ${clan.origin}/profile` : ' on your profile page'} — sign-ups attach to an account, not a Discord name.`,
    );
  }

  body.push('', contextLine(clan, event, cross));

  return {
    title: clamp(`📝 ${event.name} — getting in`, LIMIT.title),
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
async function nextEmbed(clan: ClanContext, event: EventContext, cross: CrossClanContext): Promise<DiscordEmbed> {
  const [row, allTiles] = await Promise.all([
    db.query.events.findFirst({ where: eq(events.id, event.id) }),
    db
      .select({ id: tiles.id, mission: tiles.mission, revealAt: tiles.revealAt, revealedAt: tiles.revealedAt, closedAt: tiles.closedAt })
      .from(tiles)
      .where(eq(tiles.eventId, event.id)),
  ]);
  const rules = parseEventRules(row?.rules);

  const upcoming: { what: string; at: string }[] = [];
  if (event.phase === 'upcoming' && row?.startDate) upcoming.push({ what: '🚩 Event starts', at: row.startDate });
  if (event.phase === 'running' && row?.endDate) upcoming.push({ what: '🏁 Event ends', at: row.endDate });

  const reveal = nextRevealAt({ startDate: row?.startDate ?? null, rules: row?.rules }, rules, allTiles);
  if (reveal) upcoming.push({ what: '🎲 Next tile drawn', at: reveal });

  const mission = nextMissionAt({ startDate: row?.startDate ?? null }, rules, allTiles);
  if (mission) upcoming.push({ what: '⚡ Next mission', at: mission });

  if (row?.signupDeadline && event.phase === 'upcoming') {
    upcoming.push({ what: '📝 Sign-ups close', at: row.signupDeadline });
  }

  const body: string[] = [];
  if (upcoming.length === 0) {
    body.push(
      event.phase === 'ended'
        ? 'Nothing left on the clock — this board has finished.'
        : 'Nothing scheduled. Staff drop the next thing when they drop it.',
    );
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
    body.push('', `-# ${hiddenMissions} mission${hiddenMissions === 1 ? '' : 's'} still to come, announced when staff drop them.`);
  }

  body.push('', contextLine(clan, event, cross));

  return {
    title: clamp(`⏭️ ${event.name} — what's next`, LIMIT.title),
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
function helpEmbed(clan: ClanContext, event: EventContext | null, cross: CrossClanContext): DiscordEmbed {
  const subs = (COMMAND_DEFINITIONS.find((c) => c.name === COMMAND_NAME)?.options ?? []) as readonly {
    name: string;
    description: string;
  }[];
  const body = [
    ...subs.map((o) => `${code(`/${COMMAND_NAME} ${o.name}`)} — ${o.description}`),
    '',
    '-# Answers are only visible to you. Add `share: true` to any of them to post one in the channel.',
    '',
    contextLine(clan, event, cross),
  ];
  return {
    title: '🔨 What Anvil can tell you',
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

/** Everything a subcommand needs, resolved once by handleCommand rather than per handler. */
interface CommandContext {
  clan: ClanContext;
  event: EventContext;
  cross: CrossClanContext;
  /** The invoker's linked roster rows on this instance. Empty = they're not on the roster. */
  memberIds: number[];
  /** Their display name, for prose. */
  who: string;
  options: Record<string, string | number | boolean>;
  ephemeral: boolean;
}

/**
 * The subcommands, as a lookup rather than a switch — so the set Discord advertises
 * (COMMAND_DEFINITIONS) and the set the server answers are the same list of strings, checkable by a
 * test. A command that autocompletes and then fails in front of a member is worse than one that
 * never existed.
 */
const SUBCOMMANDS: Record<string, (ctx: CommandContext) => Promise<InteractionResponse>> = {
  async board({ clan, event, cross, ephemeral }) {
    return embedReply([await boardEmbed(clan, event, cross)], { ephemeral });
  },

  async rules({ clan, event, cross, ephemeral }) {
    return embedReply(await rulesEmbeds(clan, event, cross), { ephemeral });
  },

  async leaderboard({ clan, event, cross, memberIds, ephemeral }) {
    const teamId = await myTeamId(event.id, memberIds);
    return embedReply([await leaderboardEmbed(clan, event, cross, teamId)], { ephemeral });
  },

  async apply({ clan, event, cross, memberIds, ephemeral }) {
    return embedReply([await applyEmbed(clan, event, cross, memberIds)], { ephemeral });
  },

  async next({ clan, event, cross, ephemeral }) {
    return embedReply([await nextEmbed(clan, event, cross)], { ephemeral });
  },

  async help({ clan, event, cross, ephemeral }) {
    return embedReply([helpEmbed(clan, event, cross)], { ephemeral });
  },

  async me({ clan, event, cross, memberIds, who, ephemeral }) {
    return embedReply([await meEmbed(clan, event, cross, memberIds, who)], { ephemeral });
  },

  async team({ clan, event, cross, memberIds, options, ephemeral }) {
    // Hidden boards stay hidden. Staff see them on the web; Discord is a member-facing surface with
    // no way to prove a staff role, so it shows what a member would see.
    if (!event.tilesRevealed) {
      return textReply(`Tiles on **${event.name}** aren't revealed yet — team cards open when the board does.`);
    }
    const wanted = typeof options.name === 'string' ? options.name : null;
    const fallback = await myTeamId(event.id, memberIds);
    return embedReply([await teamEmbed(clan, event, cross, wanted, fallback)], { ephemeral });
  },
};

/** The subcommands this server answers. Asserted against COMMAND_DEFINITIONS in the tests. */
export const SUBCOMMAND_NAMES = Object.keys(SUBCOMMANDS);

/**
 * Turn a verified interaction into a reply.
 *
 * Never throws: an unhandled error here becomes a Discord timeout, which shows the member "the
 * application did not respond" and tells them nothing. Every failure path answers in words.
 */
export async function handleCommand(interaction: Interaction): Promise<InteractionResponse> {
  const clan = await getClanContext();

  // 1. WHICH CLAN — refuse anything that isn't this instance's own server (see discordContext).
  const guildCheck = checkGuild(clan, interaction.guild_id);
  if (guildCheck === 'dm') {
    return textReply("Run this in your clan's Discord server — a board command needs to know which clan is asking.");
  }
  if (guildCheck === 'wrong-guild') {
    return textReply(
      `This bot is connected to a different server than **${clan.name}**'s Anvil. Ask an admin to check the server ID under Integrations.`,
    );
  }

  // Anvil registers exactly one command tree; anything else reaching this endpoint is a stale
  // registration from an older deploy that the dispatcher can no longer answer.
  if (interaction.data?.name !== COMMAND_NAME) {
    return textReply(`Anvil doesn't answer ${code(`/${interaction.data?.name ?? '?'}`)} — try ${code('/bingo board')}.`);
  }

  const { sub, options } = readSubcommand(interaction);
  const handler = sub ? SUBCOMMANDS[sub] : undefined;
  if (!handler) {
    return textReply(
      `Unknown command. Try ${SUBCOMMAND_NAMES.map((n) => code(`/${COMMAND_NAME} ${n}`)).join(', ')}.`,
    );
  }

  // 2. WHICH BOARD.
  const event = await pickEvent();
  if (!event) {
    return textReply(
      `**${clan.name}** has no boards yet.${clan.origin ? ` Staff can make one at ${clan.origin}/admin/events/new.` : ''}`,
    );
  }

  // 3. WHO ELSE IS IN IT, and who is asking.
  const cross = await getCrossClanContext(event.id);
  const discordId = invokerId(interaction);
  const identity = discordId ? await resolveInvoker(discordId) : null;

  return handler({
    clan,
    event,
    cross,
    memberIds: identity?.memberIds ?? [],
    who: invokerName(interaction),
    options,
    ephemeral: options.share !== true,
  });
}
