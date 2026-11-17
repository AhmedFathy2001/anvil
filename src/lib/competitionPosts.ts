// A competition's Discord posts between its start and its results: the DAILY RECAP, the HALFWAY
// REPORT and ENDING SOON. The counterpart of a board's daily digest and halfway report
// (lib/eventDigest), for Skill / Boss / Efficiency of the Week and the Item hunt.
//
// PURE: which posts a clan gets (the switches), when each is due (the slot maths, on the same event
// "day" a board uses: 24h slices from the start, lib/eventDay), who to name (movers, places, gaps)
// and the embeds themselves. The database half is lib/competitionPostsRun.
//
// Every new post is OFF until a clan turns it on. Started and Results were always posted; they are
// listed here too so one panel switches all five, and they stay on.

import { DAY_MS, HOUR_MS, dueDigestDay } from '@/lib/eventDay';
import { EMBED_COLOR, LIMIT, clamp, field, type DiscordEmbed, type DiscordEmbedField } from '@/lib/discordEmbeds';
import { formatEfficiencyHours, weeklyKindLabel } from '@/lib/constants';
import { projectTotal } from '@/lib/competitionInsights';
import { weeklyRsnKey } from '@/lib/weeklyRsn';

// ── the switches ─────────────────────────────────────────────────────────────────────────────────

export const COMPETITION_POST_TYPES = [
  { key: 'start', label: 'Started', help: 'When the competition goes live, with its end time.', on: true },
  { key: 'daily', label: 'Daily recap', help: 'Every 24 hours while it runs: the day’s top movers, the top 5 and the best drops. Skipped on a day nothing moved.', on: false },
  { key: 'halfway', label: 'Halfway report', help: 'Once, at the halfway point: standings, the biggest climber and the closest race.', on: false },
  { key: 'endingSoon', label: 'Ending soon', help: 'Once, 24 hours before the end, with the gaps at the top.', on: false },
  { key: 'results', label: 'Results', help: 'The winner and the final standings, with the best drops.', on: true },
] as const satisfies readonly { key: string; label: string; help: string; on: boolean }[];

export type CompetitionPostType = (typeof COMPETITION_POST_TYPES)[number]['key'];

const TYPE_BY_KEY = new Map<string, (typeof COMPETITION_POST_TYPES)[number]>(COMPETITION_POST_TYPES.map((t) => [t.key, t]));

export function isCompetitionPostType(v: unknown): v is CompetitionPostType {
  return typeof v === 'string' && TYPE_BY_KEY.has(v);
}

/** The clan's setting: what every competition of the clan starts from. */
export const CLAN_COMPETITION_POSTS_KEY = 'discord_weekly_posts';
/** One competition's own choices, stored beside its repeat setting (lib/weeklyRepeat). */
export const competitionPostsKey = (competitionId: number) => `weekly_posts:${competitionId}`;

export type ClanCompetitionPosts = Partial<Record<CompetitionPostType, boolean>>;
export type CompetitionPostOverrides = Partial<Record<CompetitionPostType, 'on' | 'off'>>;

function parseObject(raw: unknown): Record<string, unknown> {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return {};
    }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Unknown keys and non-boolean values are dropped; nothing stored means every default. */
export function parseClanCompetitionPosts(raw: unknown): ClanCompetitionPosts {
  const out: ClanCompetitionPosts = {};
  for (const [k, v] of Object.entries(parseObject(raw))) if (isCompetitionPostType(k) && typeof v === 'boolean') out[k] = v;
  return out;
}

export function parseCompetitionPostOverrides(raw: unknown): CompetitionPostOverrides {
  const out: CompetitionPostOverrides = {};
  for (const [k, v] of Object.entries(parseObject(raw))) if (isCompetitionPostType(k) && (v === 'on' || v === 'off')) out[k] = v;
  return out;
}

/** What the clan gets when a competition says nothing of its own. */
export function clanCompetitionDefault(type: CompetitionPostType, clan: ClanCompetitionPosts): boolean {
  return clan[type] ?? TYPE_BY_KEY.get(type)!.on;
}

/**
 * Does this clan get this post for this competition?
 *
 * The competition's own choice beats its host clan's setting. On a clan-vs-clan competition each
 * other clan follows ITS OWN setting, and the host can only take a post away from everyone ('off'),
 * never switch one on in somebody else's server.
 */
export function decideCompetitionPost(
  type: CompetitionPostType,
  clan: ClanCompetitionPosts,
  override: CompetitionPostOverrides,
  isHost: boolean,
): boolean {
  const own = override[type];
  if (own === 'off') return false;
  if (own === 'on' && isHost) return true;
  return clanCompetitionDefault(type, clan);
}

// ── when ─────────────────────────────────────────────────────────────────────────────────────────

/** Shorter than this and a competition gets no recap, halfway report or ending-soon post. */
export const MIN_POSTS_MS = 2 * DAY_MS;
/** How long before the end "ending soon" goes out. */
export const ENDING_SOON_LEAD_MS = DAY_MS;
/** Inside this last stretch nothing new is posted: the results are about to say it all. */
const END_GRACE_MS = HOUR_MS;

export const longEnoughForPosts = (startMs: number, endMs: number) => endMs - startMs >= MIN_POSTS_MS;

/**
 * The most recent full day whose recap is due, or null. The board's own rule (lib/eventDay
 * dueDigestDay): the LATEST day only, so a cron that was down for three days posts one recap, and
 * never a day that ends at the competition's end.
 */
export function dueRecapDay(nowMs: number, startMs: number, endMs: number): number | null {
  if (!longEnoughForPosts(startMs, endMs)) return null;
  return dueDigestDay(nowMs, startMs, endMs, END_GRACE_MS);
}

export const recapSlot = (day: number) => `day:${day}`;
export const ENDING_SLOT = 'ending';

/** The day number of a 'day:<n>' slot; null for any other slot. */
export function recapSlotDay(slot: string): number | null {
  const m = /^day:(\d+)$/.exec(slot);
  return m ? Number(m[1]) : null;
}

/** Past the midpoint and not yet over, on a competition long enough to have a half worth reporting. */
export function halfwayReportDue(nowMs: number, startMs: number, endMs: number): boolean {
  if (!longEnoughForPosts(startMs, endMs)) return false;
  return nowMs >= startMs + (endMs - startMs) / 2 && nowMs < endMs;
}

/** Inside the last 24 hours, but not the last one. A tick that comes later than that posts nothing. */
export function endingSoonDue(nowMs: number, startMs: number, endMs: number): boolean {
  if (!longEnoughForPosts(startMs, endMs)) return false;
  return nowMs >= endMs - ENDING_SOON_LEAD_MS && nowMs < endMs - END_GRACE_MS;
}

/**
 * ONE POST PER MOMENT. A competition measured in whole days has its posts land together: a week's
 * day-6 recap and its "ending soon" are both due 24 hours before the end, and a four-day one reaches
 * halfway exactly as day 2 closes. A clan with both switched on gets the bigger one only: ending
 * soon, else the halfway report, else the recap. This says which of those a recap day (or the
 * halfway point, with no `day`) falls on.
 */
export function momentClash(startMs: number, endMs: number, day?: number): { endingSoon: boolean; halfway: boolean } {
  const at = day == null ? startMs + (endMs - startMs) / 2 : startMs + day * DAY_MS;
  const near = (ms: number) => Math.abs(at - ms) < HOUR_MS;
  return { endingSoon: near(endMs - ENDING_SOON_LEAD_MS), halfway: day != null && near(startMs + (endMs - startMs) / 2) };
}

// ── who ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * One line of a competition's board, best first, as every post reads it. `gained` is the gain in the
 * competition's own metric, or the count of drops on an item hunt; `kills` is a hunt's tracked kill
 * count (or XP) since the start, when the hunt tracks one.
 */
export interface BoardLine {
  rsn: string;
  gained: number;
  kills?: number | null;
}

/** What a daily slot stores: `{ rsnKey: [gained, place, kills] }`, scorers only. */
export interface DaySlotData {
  p: Record<string, [number, number, number]>;
}

const gainOf = (l: BoardLine) => Math.max(0, l.gained);
const killsOf = (l: BoardLine) => Math.max(0, l.kills ?? 0);

/** The people with something to their name, in the board's order. Place is the position among them. */
export function scorers(board: readonly BoardLine[]): (BoardLine & { place: number })[] {
  return board.filter((l) => gainOf(l) > 0).map((l, i) => ({ ...l, gained: gainOf(l), place: i + 1 }));
}

/** The board as a slot row keeps it. Somebody with no gain and no kills is left out (absent = zero). */
export function daySlotData(board: readonly BoardLine[]): DaySlotData {
  const p: DaySlotData['p'] = {};
  const places = new Map(scorers(board).map((l) => [weeklyRsnKey(l.rsn), l.place]));
  for (const l of board) {
    if (gainOf(l) <= 0 && killsOf(l) <= 0) continue;
    const key = weeklyRsnKey(l.rsn);
    p[key] = [gainOf(l), places.get(key) ?? 0, killsOf(l)];
  }
  return { p };
}

export function parseDaySlotData(raw: string | null | undefined): DaySlotData | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as DaySlotData;
    return v && typeof v === 'object' && v.p && typeof v.p === 'object' ? v : null;
  } catch {
    return null;
  }
}

export interface Mover {
  rsn: string;
  gain: number;
}

/** Who gained the most since the last slot (since the start when there is none), biggest first. */
export function topMovers(board: readonly BoardLine[], prev: DaySlotData | null, count = 5): Mover[] {
  return board
    .map((l) => ({ rsn: l.rsn, gain: gainOf(l) - (prev?.p[weeklyRsnKey(l.rsn)]?.[0] ?? 0) }))
    .filter((m) => m.gain > 0)
    .sort((a, b) => b.gain - a.gain || a.rsn.localeCompare(b.rsn))
    .slice(0, count);
}

/** Tracked kills (or XP) added across the whole board since the last slot. */
export function killsMoved(board: readonly BoardLine[], prev: DaySlotData | null): number {
  return board.reduce((sum, l) => sum + Math.max(0, killsOf(l) - (prev?.p[weeklyRsnKey(l.rsn)]?.[2] ?? 0)), 0);
}

export interface PlacedLine {
  rsn: string;
  gained: number;
  place: number;
  /** Places climbed since the last slot (negative = dropped); 0 with no earlier place to compare. */
  moved: number;
}

/** The top of the board with each line's change in place since the last slot. */
export function topWithMoves(board: readonly BoardLine[], prev: DaySlotData | null, count = 5): PlacedLine[] {
  return scorers(board)
    .slice(0, count)
    .map((l) => {
      const before = prev?.p[weeklyRsnKey(l.rsn)]?.[1] ?? 0;
      return { rsn: l.rsn, gained: l.gained, place: l.place, moved: before > 0 ? before - l.place : 0 };
    });
}

/** Scorers who had nothing at the last slot. Empty without a last slot: on day one everybody is new. */
export function newOnBoard(board: readonly BoardLine[], prev: DaySlotData | null): string[] {
  if (!prev) return [];
  return scorers(board)
    .filter((l) => (prev.p[weeklyRsnKey(l.rsn)]?.[0] ?? 0) <= 0)
    .map((l) => l.rsn);
}

/**
 * The biggest climb: for each scorer, the worst place they held at the start of any earlier day
 * (weekly_day_ranks, `{ rsnKey: place }` per day) against their place now. Null when nobody climbed
 * at least `minClimb` places. Ties go to whoever stands higher now.
 */
export function biggestClimber(
  history: readonly Record<string, number>[],
  board: readonly BoardLine[],
  minClimb = 2,
): { rsn: string; from: number; to: number } | null {
  let best: { rsn: string; from: number; to: number } | null = null;
  for (const l of scorers(board)) {
    const key = weeklyRsnKey(l.rsn);
    let worst = l.place;
    for (const day of history) {
      const r = day[key];
      if (typeof r === 'number' && r > worst) worst = r;
    }
    const climb = worst - l.place;
    if (climb < minClimb) continue;
    if (!best || climb > best.from - best.to) best = { rsn: l.rsn, from: worst, to: l.place };
  }
  return best;
}

export interface Gap {
  /** The place of the one behind: 2 for "2nd is … behind 1st". */
  place: number;
  ahead: string;
  behind: string;
  gap: number;
}

/** The gap between each pair of adjacent places among the top `places` scorers. */
export function topGaps(board: readonly BoardLine[], places = 3): Gap[] {
  const top = scorers(board).slice(0, places);
  const out: Gap[] = [];
  for (let i = 1; i < top.length; i++) out.push({ place: top[i].place, ahead: top[i - 1].rsn, behind: top[i].rsn, gap: top[i - 1].gained - top[i].gained });
  return out;
}

/** The tightest of those gaps in the top ten: the race worth watching. Earlier places win a tie. */
export function closestRace(board: readonly BoardLine[], places = 10): Gap | null {
  let best: Gap | null = null;
  for (const g of topGaps(board, places)) if (!best || g.gap < best.gap) best = g;
  return best;
}

// ── the words ────────────────────────────────────────────────────────────────────────────────────

/** How a post names the competition: its kind, and for an item hunt what it hunts and what it tracks. */
export interface PostSubject {
  type: string;
  title: string;
  endDate: string;
  /** Item hunt only (lib/itemHunt): 'Item hunt' | 'Pet hunt', and "Uncut onyx from Zulrah · most by the end". */
  hunt?: { kind: string; line: string; rule: 'first' | 'most'; tracks: 'kills' | 'XP' | null } | null;
}

const medal = (place: number) => (place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `${place}.`);
const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};
const num = (n: number) => Math.round(n).toLocaleString('en-US');

/** "412,300 XP", "12 KC", "3.25 hours", "2 drops": an amount in the competition's own unit. */
export function amountWords(type: string, n: number): string {
  if (type === 'hunt') return `${num(n)} ${Math.round(n) === 1 ? 'drop' : 'drops'}`;
  if (type === 'efficiency') return `${formatEfficiencyHours(Math.round(n))} hours`;
  return `${num(n)} ${type === 'skill' ? 'XP' : 'KC'}`;
}

const gainWords = (type: string, n: number) => (type === 'hunt' ? amountWords(type, n) : `+${amountWords(type, n)}`);
const kindOf = (s: PostSubject) => s.hunt?.kind ?? weeklyKindLabel(s.type);
const endsIn = (endDate: string) => {
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(endDate) ? `${endDate.replace(' ', 'T')}Z` : endDate);
  return Number.isFinite(ms) ? `<t:${Math.floor(ms / 1000)}:R>` : 'soon';
};

/** Names in a row, cut to `max` with "and N more". */
function nameList(names: readonly string[], max = 10): string {
  const shown = names.slice(0, max).map((n) => `**${n}**`);
  return names.length > max ? `${shown.join(', ')} and ${names.length - max} more` : shown.join(', ');
}

function standingLines(type: string, lines: readonly (BoardLine & { place: number; moved?: number })[]): string {
  return lines
    .map((l) => {
      const arrow = (l.moved ?? 0) > 0 ? ` ▲${l.moved}` : (l.moved ?? 0) < 0 ? ` ▼${-(l.moved ?? 0)}` : '';
      return `${medal(l.place)} **${l.rsn}** — ${gainWords(type, l.gained)}${arrow}`;
    })
    .join('\n');
}

function gapLine(type: string, g: Gap): string {
  if (g.gap <= 0) return `${ordinal(g.place)} is level with ${ordinal(g.place - 1)}: **${g.behind}** and **${g.ahead}**`;
  return `${ordinal(g.place)} is ${amountWords(type, g.gap)} behind ${ordinal(g.place - 1)}: **${g.behind}** chasing **${g.ahead}**`;
}

/** "14 players, 3,120 kills, no drop yet": an item hunt nobody has scored in. */
export function noDropYetLine(players: number, kills: number, tracks: 'kills' | 'XP' | null): string {
  const who = `${num(players)} ${players === 1 ? 'player' : 'players'}`;
  return tracks && kills > 0 ? `${who}, ${num(kills)} ${tracks}, no drop yet` : `${who}, no drop yet`;
}

const DISCORD_TOTAL = 6000;

/**
 * Keep an embed inside Discord's limits: 25 fields, and 6,000 characters over the title, the
 * description, the author and every field. The LAST fields go first: the builders put what matters
 * at the top.
 */
export function fitEmbed<T extends DiscordEmbed>(embed: T): T {
  const fields = [...(embed.fields ?? [])].slice(0, 25);
  const size = () =>
    (embed.title?.length ?? 0) +
    (embed.description?.length ?? 0) +
    (embed.author?.name.length ?? 0) +
    (embed.footer?.text.length ?? 0) +
    fields.reduce((n, f) => n + f.name.length + f.value.length, 0);
  // 60 spare for the footer every post is stamped with on its way out (lib/discordEmbeds stampEmbeds).
  while (fields.length > 0 && size() > DISCORD_TOTAL - 60) fields.pop();
  return { ...embed, fields };
}

function drops(label: string, lines: readonly string[]): DiscordEmbedField | null {
  const top = lines.filter(Boolean).slice(0, 3);
  return top.length ? field(label, top.map((l, i) => `${medal(i + 1)} ${clamp(l, 300)}`).join('\n'), false) : null;
}

// ── the daily recap ──────────────────────────────────────────────────────────────────────────────

export interface DailyRecapInput {
  subject: PostSubject;
  /** The day this recap closes, and the day the last one closed (0 = none yet). */
  day: number;
  fromDay: number;
  board: readonly BoardLine[];
  prev: DaySlotData | null;
  /** Best drops of the window, best first, one line each (lib/bestDrops bestDropLine). Not for a hunt. */
  bestDrops?: readonly string[];
  /** Item hunt: the drops that landed in the window, oldest first, one line each. */
  huntDrops?: readonly string[];
}

/**
 * The daily recap, or NULL on a day nothing moved: nobody gained, no drop landed, and on a hunt
 * nobody even added a kill. A recap of nothing is not posted.
 */
export function dailyRecapEmbed(input: DailyRecapInput): DiscordEmbed | null {
  const { subject, day, fromDay, board, prev } = input;
  const type = subject.type;
  const span = day - fromDay > 1 ? `days ${fromDay + 1}–${day}` : `day ${day}`;
  const since = day - fromDay > 1 ? 'since the last recap' : 'last 24 hours';
  const top = topWithMoves(board, prev);
  const fields: DiscordEmbedField[] = [];
  let description: string;

  if (subject.hunt) {
    const landed = (input.huntDrops ?? []).filter(Boolean);
    if (landed.length === 0 && killsMoved(board, prev) <= 0) return null;
    if (landed.length) {
      const shown = landed.slice(0, 10).map((l) => clamp(l, 90));
      fields.push(field(`Drops, ${since}`, shown.join('\n') + (landed.length > 10 ? `\nand ${landed.length - 10} more` : ''), false));
    }
    if (top.length) {
      fields.push(field(top.length === 1 ? 'Leader' : 'Leaders', standingLines(type, top), false));
      description = landed.length
        ? `**${subject.hunt.line}**\n${amountWords(type, landed.length)} landed. Ends ${endsIn(subject.endDate)}.`
        : `**${subject.hunt.line}**\nNo new drops. **${top[0].rsn}** still leads. Ends ${endsIn(subject.endDate)}.`;
    } else {
      const kills = board.reduce((n, l) => n + killsOf(l), 0);
      description = `**${subject.hunt.line}**\n${noDropYetLine(board.length, kills, subject.hunt.tracks)}. Ends ${endsIn(subject.endDate)}.`;
    }
  } else {
    const movers = topMovers(board, prev);
    const best = drops(day - fromDay > 1 ? 'Best drops since the last recap' : 'Best drops today', input.bestDrops ?? []);
    if (movers.length === 0 && !best) return null;
    if (movers.length) {
      fields.push(field(`Top movers, ${since}`, movers.map((m, i) => `${i + 1}. **${m.rsn}** ${gainWords(type, m.gain)}`).join('\n'), false));
    }
    if (top.length) fields.push(field(`Top ${Math.min(5, top.length)}`, standingLines(type, top), false));
    const joined = newOnBoard(board, prev);
    if (joined.length) fields.push(field('New on the board', nameList(joined), false));
    if (best) fields.push(best);
    description = movers.length
      ? `**${movers[0].rsn}** had the biggest day: **${gainWords(type, movers[0].gain)}**. Ends ${endsIn(subject.endDate)}.`
      : `Nobody moved on the board, but drops landed. Ends ${endsIn(subject.endDate)}.`;
  }

  return fitEmbed({
    author: { name: clamp(`${kindOf(subject)} · ${span}`, LIMIT.author) },
    title: clamp(`📅 ${subject.title}`, LIMIT.title),
    description: clamp(description, LIMIT.description),
    color: EMBED_COLOR.gold,
    fields,
  });
}

// ── the halfway report ───────────────────────────────────────────────────────────────────────────

export interface HalfwayInput {
  subject: PostSubject;
  board: readonly BoardLine[];
  /** Places at the start of each day so far (weekly_day_ranks), oldest first. */
  history: readonly Record<string, number>[];
  startMs: number;
  endMs: number;
  nowMs: number;
  bestDrops?: readonly string[];
}

/** The halfway report, or NULL when nobody has scored and there is nothing to report. */
export function halfwayEmbed(input: HalfwayInput): DiscordEmbed | null {
  const { subject, board } = input;
  const type = subject.type;
  const ranked = scorers(board);
  const fields: DiscordEmbedField[] = [];
  let description: string;

  if (ranked.length === 0) {
    if (!subject.hunt) return null;
    const kills = board.reduce((n, l) => n + killsOf(l), 0);
    description = `**${subject.hunt.line}**\nHalfway there. ${noDropYetLine(board.length, kills, subject.hunt.tracks)}. Ends ${endsIn(subject.endDate)}.`;
  } else {
    const lead = ranked[0];
    description = subject.hunt
      ? `**${subject.hunt.line}**\nHalfway there. **${lead.rsn}** leads with **${amountWords(type, lead.gained)}**. Ends ${endsIn(subject.endDate)}.`
      : `Halfway there. **${lead.rsn}** leads with **${gainWords(type, lead.gained)}**. Ends ${endsIn(subject.endDate)}.`;
    fields.push(field('Standings so far', standingLines(type, ranked.slice(0, 10)), false));

    const climber = biggestClimber(input.history, board);
    if (climber) fields.push(field('Biggest climber', `**${climber.rsn}** climbed from ${ordinal(climber.from)} to ${ordinal(climber.to)}`, false));

    const race = closestRace(board);
    if (race) fields.push(field('Closest race', gapLine(type, race), false));

    // Pace is the clan's total at the pace so far (lib/competitionInsights projectTotal), which
    // refuses to guess before a full day has passed. Not for a hunt: drops do not come at a pace.
    if (!subject.hunt) {
      const total = ranked.reduce((n, l) => n + l.gained, 0);
      const projected = projectTotal(total, (input.nowMs - input.startMs) / DAY_MS, (input.endMs - input.startMs) / DAY_MS);
      if (projected != null && projected > total) {
        fields.push(field('Pace', `${amountWords(type, total)} between ${num(ranked.length)} ${ranked.length === 1 ? 'player' : 'players'} so far: on pace for ${amountWords(type, projected)} by the end`, false));
      }
    }
    const best = drops('Best drops so far', input.bestDrops ?? []);
    if (best) fields.push(best);
  }

  return fitEmbed({
    author: { name: clamp(`${kindOf(subject)} · halfway`, LIMIT.author) },
    title: clamp(`⏳ ${subject.title}`, LIMIT.title),
    description: clamp(description, LIMIT.description),
    color: EMBED_COLOR.gold,
    fields,
  });
}

// ── ending soon ──────────────────────────────────────────────────────────────────────────────────

export interface EndingSoonInput {
  subject: PostSubject;
  board: readonly BoardLine[];
  /** The last daily slot, when there is one: adds who moved since, as this post stands in for that day's recap. */
  prev?: DaySlotData | null;
}

/** Ending soon. Always something to say: it is a reminder first, and the gaps are the reason to act on it. */
export function endingSoonEmbed(input: EndingSoonInput): DiscordEmbed {
  const { subject, board } = input;
  const type = subject.type;
  const ranked = scorers(board);
  const fields: DiscordEmbedField[] = [];
  const ends = `Ends ${endsIn(subject.endDate)}.`;
  let description: string;

  if (ranked.length === 0) {
    const kills = board.reduce((n, l) => n + killsOf(l), 0);
    description = subject.hunt
      ? `**${subject.hunt.line}**\n${ends} ${noDropYetLine(board.length, kills, subject.hunt.tracks)}: it is still anyone’s.`
      : `${ends} Nobody has scored yet: it is wide open.`;
  } else {
    const gaps = topGaps(board, 3);
    const head = subject.hunt ? `**${subject.hunt.line}**\n${ends}` : ends;
    description = gaps.length
      ? `${head}\n${gaps.map((g) => gapLine(type, g)).join('\n')}`
      : `${head} **${ranked[0].rsn}** is out in front on their own with ${amountWords(type, ranked[0].gained)}.`;
    fields.push(field(`Top ${Math.min(5, ranked.length)}`, standingLines(type, input.prev ? topWithMoves(board, input.prev) : ranked.slice(0, 5)), false));
    const movers = input.prev && !subject.hunt ? topMovers(board, input.prev, 3) : [];
    if (movers.length) fields.push(field('Top movers since the last recap', movers.map((m, i) => `${i + 1}. **${m.rsn}** ${gainWords(type, m.gain)}`).join('\n'), false));
  }

  return fitEmbed({
    author: { name: clamp(`${kindOf(subject)} · ending soon`, LIMIT.author) },
    title: clamp(`⏰ ${subject.title}`, LIMIT.title),
    description: clamp(description, LIMIT.description),
    color: EMBED_COLOR.amber,
    fields,
  });
}

// ── samples ──────────────────────────────────────────────────────────────────────────────────────

/** Each new post built from made-up players, for the previews (the settings panel, lib/discordSamples). */
export function sampleCompetitionEmbed(type: 'daily' | 'halfway' | 'endingSoon', nowMs = Date.now()): DiscordEmbed {
  const startMs = nowMs - 3.5 * DAY_MS;
  const endMs = startMs + 7 * DAY_MS;
  const subject: PostSubject = { type: 'skill', title: 'SOTW: Agility', endDate: new Date(type === 'endingSoon' ? nowMs + 23 * HOUR_MS : endMs).toISOString() };
  const board: BoardLine[] = [
    { rsn: 'Zezima', gained: 1_204_300 },
    { rsn: 'Iron Mole', gained: 1_163_100 },
    { rsn: 'Dusty Boots', gained: 902_750 },
    { rsn: 'Cabbage Pult', gained: 611_000 },
    { rsn: 'Rune Newt', gained: 240_500 },
    { rsn: 'Tin Lantern', gained: 88_200 },
  ];
  const prev: DaySlotData = { p: { zezima: [792_000, 2, 0], 'iron mole': [1_010_000, 1, 0], 'dusty boots': [640_000, 3, 0], 'cabbage pult': [611_000, 4, 0], 'tin lantern': [61_000, 5, 0] } };
  const bestDrops = ['**Dusty Boots** · Giant squirrel (1 in 26,404)', '**Cabbage Pult** · Mark of grace ×140'];
  if (type === 'daily') return dailyRecapEmbed({ subject, day: 3, fromDay: 2, board, prev, bestDrops })!;
  if (type === 'halfway') {
    return halfwayEmbed({ subject, board, history: [{ zezima: 4, 'iron mole': 1, 'dusty boots': 2, 'cabbage pult': 3 }, { zezima: 2 }], startMs, endMs, nowMs, bestDrops })!;
  }
  return endingSoonEmbed({ subject, board, prev });
}
