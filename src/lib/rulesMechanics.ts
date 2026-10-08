// A board's rules, as words — shared by `/bingo rules`, the rules post to every clan on the board,
// and the Rules card on the event page, so all three say exactly the same thing.
//
// Two kinds of rule get confused with each other, so they are kept visibly apart:
//
//   MECHANICS — how THIS board scores and reveals. Anvil knows these exactly (they're the event's
//   own configuration), they differ per board, and they're the ones people actually get wrong:
//   "does first team get a bonus?", "why is that tile locked?", "do I need a starting shot?".
//   Derived fresh every time, so they can never drift from what the board is really doing.
//
//   RULEBOOK — prose in the host's words: keep a screenshot, use the plugin, don't cheat. The
//   event's own `rulebook`, else the host clan's house rules (lib/eventRulebook picks).
//
// Pure: no `@/db`. The facts come in from lib/eventRulebook; the strings from the Discord dictionary
// (English on the site). Lines are Discord-flavoured markdown, which the site's guide renderer reads.

import { formatGp } from '@/lib/adminEventsFormat';
import { EMBED_COLOR, LIMIT, clamp, code, type DiscordEmbed } from '@/lib/discordEmbeds';
import { fmt, plural, type DiscordDict } from '@/lib/discordI18n';
import type { EventRules } from '@/lib/eventRules';

/** The slice of an event the mechanics read. */
export interface MechanicsEvent {
  scoringMode: string;
  format: string;
  tilesRevealed: boolean;
  playerCount: number;
}

/** Everything the rules read about a board, loaded once (lib/eventRulebook.loadRulesFacts). */
export interface RulesFacts {
  event: MechanicsEvent & { id: number; name: string };
  rules: EventRules;
  pool: number;
  fee: number | null;
  missionCounts: { total: number; announced: number };
  /** Board tiles only (missions excluded) — how credit reaches them. */
  boardTiles: { trackedStat: string | null }[];
  /** Host-edited first Discord embed body. Null means derive it live from the mechanics above. */
  rulesMessage: string | null;
  rulebook: Rulebook;
}

/** The prose half. `source` says whose words: the event's own, the host clan's, or nobody's. */
export interface Rulebook {
  text: string | null;
  url: string | null;
  source: 'event' | 'clan' | 'none';
  hostClanName: string;
}

/**
 * The event's own rulebook wins; blank falls back to the HOST clan's house rules. The link is always
 * the host's. A co-host's own house rules never enter into it — the board is the host's, and every
 * clan playing it reads one rulebook.
 */
export function pickRulebook(
  eventText: string | null | undefined,
  hostClanText: string | null | undefined,
  hostClanUrl: string | null | undefined,
  hostClanName: string,
): Rulebook {
  const own = eventText?.trim() || null;
  const clan = hostClanText?.trim() || null;
  const url = hostClanUrl?.trim() || null;
  if (own) return { text: own, url, source: 'event', hostClanName };
  if (clan || url) return { text: clan, url, source: 'clan', hostClanName };
  return { text: null, url: null, source: 'none', hostClanName };
}

/** Sentences describing how the board scores and opens. One bullet per rule that is actually on. */
export function mechanicsLines(
  t: DiscordDict,
  event: MechanicsEvent,
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
 * paragraph of general advice. `origin` is where the reader uploads proof — their own clan's site.
 */
export function trackingLines(
  t: DiscordDict,
  origin: string | null,
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
    const where = origin ? fmt(t.rules.trackingWhereUrl, { url: origin }) : t.rules.trackingWhereNoUrl;
    out.push(
      proof === boardTilesOnly.length
        ? fmt(t.rules.trackingProofAll, { where })
        : fmt(t.rules.trackingProofSome, { n: proof, where }),
    );
  }
  out.push(t.rules.trackingKeepShot);
  return out;
}

/** The editable first-embed draft, before its per-clan context footer is added. */
export function defaultRulesMessage(t: DiscordDict, facts: RulesFacts, origin: string | null): string {
  return [
    ...mechanicsLines(t, facts.event, facts.rules, facts.pool, facts.fee, facts.missionCounts),
    // Tile names stay hidden on an unrevealed board, but HOW tracking works is not a spoiler.
    ...trackingLines(t, origin, facts.boardTiles),
  ].join('\n');
}

/**
 * The rulebook as its own embed. It rides in a SEPARATE embed rather than appended to the mechanics:
 * it's a different kind of statement (policy, not board configuration) and mixing them makes both
 * skimmable by nobody. Long rulebooks get their first part plus a link — Discord's 4096-character
 * cap is not a place to dump a full rules document, and a truncated rule reads as a complete one.
 */
export function rulebookEmbed(t: DiscordDict, rulebook: Rulebook, eventUrl?: string): DiscordEmbed | null {
  if (!rulebook.text && !rulebook.url) return null;
  const full = rulebook.text ?? '';
  const truncated = full.length > LIMIT.description - 200;
  const shown = truncated ? `${full.slice(0, LIMIT.description - 200).trimEnd()}…` : full;
  const eventRulesUrl = eventUrl
    ? `${eventUrl}${eventUrl.includes('?') ? '&' : '?'}rules=1#rules`
    : null;
  let tail = '';
  if (rulebook.url) {
    tail = `\n\n${truncated ? t.rules.houseContinues : t.rules.houseFull} ${rulebook.url}`;
  } else if (truncated && eventRulesUrl) {
    tail = `\n\n${fmt(t.rules.houseEventPage, { url: eventRulesUrl })}`;
  } else if (truncated) {
    tail = `\n\n${t.rules.houseTrimmed}`;
  }
  return {
    title: clamp(fmt(t.rules.houseTitle, { clan: clamp(rulebook.hostClanName, 80) }), LIMIT.title),
    description: clamp(`${shown}${tail}`.trim(), LIMIT.description),
    color: EMBED_COLOR.blue,
  };
}

/**
 * The full rules answer: mechanics (+ how tracking works) in one embed, the rulebook in a second.
 * `origin` and `eventUrl` are the READER's clan's — a co-host plays from home, so its members are
 * sent to their own site. `footer` is the provenance line the caller stamps (contextLine).
 */
export function buildRulesEmbeds(
  t: DiscordDict,
  facts: RulesFacts,
  opts: {
    origin: string | null;
    eventUrl?: string;
    author?: DiscordEmbed['author'];
    fields?: DiscordEmbed['fields'];
    footer?: string;
  },
): DiscordEmbed[] {
  const message = facts.rulesMessage?.trim() || defaultRulesMessage(t, facts, opts.origin);
  const body = [message, ...(opts.footer ? ['', opts.footer] : [])];
  const embeds: DiscordEmbed[] = [
    {
      title: clamp(fmt(t.rules.title, { event: facts.event.name }), LIMIT.title),
      ...(opts.eventUrl ? { url: opts.eventUrl } : {}),
      description: clamp(body.join('\n'), LIMIT.description),
      color: EMBED_COLOR.gold,
      ...(opts.author ? { author: opts.author } : {}),
      ...(opts.fields ? { fields: opts.fields } : {}),
    },
  ];
  const book = rulebookEmbed(t, facts.rulebook, opts.eventUrl);
  if (book) embeds.push(book);
  return embeds;
}
