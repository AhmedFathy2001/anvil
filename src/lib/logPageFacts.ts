import { BOSSES } from '@/lib/constants';
import { assessLuckAt, dropsFromQuantity, type LuckAssessment } from '@/lib/clogLuck';
import { bossKeysForPage } from '@/lib/clogKillcounts';
import { expectationFor, type LuckRateSource } from '@/lib/clogProfile';
import { personalBestEntries } from '@/lib/pbGroups';
import { bossKeyForName, normalizeBossName } from '@/lib/pluginStats';
import { obtainedShare } from '@/lib/pluginEmbeds';

// What the panel's log page says under its items, and what a display-case pin says under its name:
// a best time and kill count per mode of the page's boss, and how each owned drop went against its
// rate. Pure — the caller reads the rows; every number here comes from the existing luck maths
// (lib/clogLuck assessLuckAt, lib/clogProfile expectationFor, lib/pluginEmbeds obtainedShare).

export type LuckTone = 'green' | 'dry' | 'muted';

export interface LuckLine {
  text: string;
  tone: LuckTone;
}

const n = (v: number) => Math.round(v).toLocaleString('en-US');
/** "11", "0.5": a whole number from ten up, one place under it. */
const say = (v: number) => (v >= 10 ? n(v) : v.toFixed(1));
const rate = (d: number) => `1/${d >= 100 ? n(d) : Number(d.toFixed(1)).toString()}`;

/** The word for a held-vs-expected result: the two tails, then the lean of the neutral band. */
export function luckWord(a: LuckAssessment): LuckLine {
  if (a.verdict === 'spooned') return { text: a.tail < 0.01 ? 'mega spooned' : 'spooned', tone: 'green' };
  if (a.verdict === 'dry') return { text: a.tail < 0.01 ? 'very dry' : 'dry', tone: 'dry' };
  if (a.ratio >= 1.25) return { text: 'lucky', tone: 'green' };
  if (a.ratio <= 0.75) return { text: 'a bit dry', tone: 'dry' };
  return { text: 'on rate', tone: 'muted' };
}

/** The word for a first drop at `share` (the share of players who'd have it by that kill). */
export function firstDropWord(share: number): LuckLine {
  if (share < 0.02) return { text: 'mega spooned', tone: 'green' };
  if (share < 0.1) return { text: 'spooned', tone: 'green' };
  if (share < 0.35) return { text: 'lucky', tone: 'green' };
  if (share >= 0.95) return { text: 'very dry', tone: 'dry' };
  if (share >= 0.85) return { text: 'dry', tone: 'dry' };
  if (share >= 0.65) return { text: 'a bit dry', tone: 'dry' };
  return { text: 'on rate', tone: 'muted' };
}

/**
 * How an owned drop went, or null when the rate or the kills behind it aren't known.
 * - one drop with the kill it came at, from one source: "1st at 22 kc · rate 1/50 · lucky"
 * - otherwise drops held against what the rate owed by now: "8 in 1,378 kc · expected 11 · a bit dry"
 * A stack collapses to the number of drops behind it (dropsFromQuantity), so 750 axes are one drop.
 */
export function itemLuck(
  item: { quantity: number; kcAtUnlock?: number | null },
  sources: LuckRateSource[],
  kills: Record<string, number>,
): LuckLine | null {
  if (!(item.quantity > 0) || !sources.length) return null;
  const { expected, expectedLow, bundle, kills: kc } = expectationFor(sources, kills);
  const drops = dropsFromQuantity(item.quantity, bundle);
  const at = item.kcAtUnlock ?? 0;
  if (drops === 1 && at > 0 && sources.length === 1) {
    const s = sources[0];
    const word = firstDropWord(obtainedShare(1 / s.denominator, at, s.rolls));
    return { text: `1st at ${n(at)} kc · rate ${rate(s.denominator)} · ${word.text}`, tone: word.tone };
  }
  if (!(kc > 0) || !(expected > 0)) return null;
  const word = luckWord(assessLuckAt(expected, kc, drops, expectedLow));
  const owed = say(expectedLow) === say(expected) ? say(expected) : `${say(expectedLow)}–${say(expected)}`;
  return { text: `${n(drops)} in ${n(kc)} kc · expected ${owed} · ${word.text}`, tone: word.tone };
}

export interface PageBestRow {
  /** The mode as a player names it: "Brutus", "Demonic Brutus", "Theatre of Blood: Hard Mode". */
  name: string;
  /** Best time, or null for a mode with kills and no time. */
  time: string | null;
  kc: number | null;
}

/** Lowercase words, the counting words and "mode" dropped: "Theatre of Blood (Hard) completions" = "Theatre of Blood: Hard Mode". */
const STOP = new Set(['kills', 'kill', 'count', 'kc', 'completions', 'completion', 'chests', 'chest', 'opened', 'mode', 'the']);
const core = (s: string) => normalizeBossName(s).split(' ').filter((w) => w && !STOP.has(w)).join(' ');
const LABEL = new Map(BOSSES.map((b) => [b.key, b.label]));

/**
 * One row per mode of a page's boss: its best time (from the times already matched to the page,
 * lib/clogProfile matchBestsToPages) and its kill count — the game's own line when the plugin read
 * one, else the hiscores key the mode's name is for. A key two modes could both claim ("Demonic
 * Brutus" is an alias of Brutus) goes to the mode named exactly like the boss. Modes with kills and
 * no time follow, so every mode the page counts is listed once.
 */
export function pageBestRows(
  page: string,
  bests: { activity: string; time: string }[],
  lines: { label: string; count: number }[],
  bossKills: Record<string, number>,
): PageBestRow[] {
  const keys = new Set(bossKeysForPage(page));
  const entries = personalBestEntries(bests);
  const usedLines = new Set<number>();
  const usedKeys = new Set<string>();
  const keyOf = (name: string): string | null => {
    const key = bossKeyForName(name);
    return key && keys.has(key) ? key : null;
  };
  const exact = (name: string, key: string) => core(name) === core(LABEL.get(key) ?? '');
  const rows: PageBestRow[] = entries.map((e) => {
    const li = lines.findIndex((l, i) => !usedLines.has(i) && core(l.label) === core(e.name));
    if (li >= 0) {
      usedLines.add(li);
      return { name: e.name, time: e.best, kc: lines[li].count };
    }
    const key = keyOf(e.name);
    const rivals = key ? entries.filter((o) => keyOf(o.name) === key) : [];
    const mine = key && (rivals.length === 1 || exact(e.name, key)) && !usedKeys.has(key);
    if (mine) usedKeys.add(key);
    const kc = mine ? bossKills[key] ?? 0 : 0;
    return { name: e.name, time: e.best, kc: kc > 0 ? kc : null };
  });
  if (lines.length) {
    lines.forEach((l, i) => {
      if (!usedLines.has(i) && l.count > 0) rows.push({ name: l.label.replace(/\s+(kills?|kill count|completions?|chests? opened|count)$/i, ''), time: null, kc: l.count });
    });
  } else {
    for (const key of keys) {
      const kc = bossKills[key] ?? 0;
      if (!usedKeys.has(key) && kc > 0) rows.push({ name: LABEL.get(key) ?? key, time: null, kc });
    }
  }
  return rows;
}
