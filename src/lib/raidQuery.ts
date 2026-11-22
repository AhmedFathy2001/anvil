// The raid tile's typed box: "5 cm challenge time, tob hm 4+ challenge time, toa 300 solo,
// deathless" read into a TileConditions draft, and a draft written back as words the box reads the
// same way. Pure (no React, no database), so the creator, the bulk importer and the tests share it.
//
// Rules of reading:
// - A modifier (time, party, scale, challenge time, ToA level) belongs to the raid it follows;
//   one typed before any raid waits for the first raid named.
// - Deaths, teammates, "counted once" and start counts ("first", "under 5 kc") are the whole tile's.
// - A word that cannot apply where it was typed (scaled on ToB, challenge time on Normal CoX, a
//   party bigger than the raid takes) is returned as a problem with a plain reason. Never guessed.

import {
  RAID_PARTY_MAX,
  challengeSeconds,
  clockWords,
  raidOffers,
  type PartyBar,
  type RaidId,
  type RaidModeId,
  type RaidPick,
  type StartCount,
  type TileConditions,
  type ToaBar,
} from '@/lib/tileConditions';
import { RAID_OPTIONS, defaultRaidSelection, raidModeKey, raidTileConfig, type RaidSelection } from '@/lib/tileCreatorConfig';
import type { TileConfig } from '@/lib/types';

export interface RaidQueryProblem {
  /** The words as typed. */
  text: string;
  /** Character offsets into the typed text (end exclusive), for underlining. */
  start: number;
  end: number;
  why: string;
}

export interface RaidQueryResult {
  /** Clears needed, when a number was typed for it. */
  clears: number | null;
  conditions: TileConditions;
  problems: RaidQueryProblem[];
}

export const RAID_NAME: Record<RaidId, string> = { cox: 'CoX', tob: 'ToB', toa: 'ToA', tfa: 'TFA' };

/** Every mode of a raid except Entry: what naming the raid alone means (defaultRaidSelection). */
export function defaultModes(raid: RaidId): RaidModeId[] {
  return RAID_OPTIONS.find((r) => r.id === raid)!.modes.filter((m) => m.id !== 'entry').map((m) => m.id);
}

export const DEFAULT_TOA: ToaBar = { min: 150, entry: false };

/** A fresh pick for a raid, as naming it alone means. */
export function newPick(raid: RaidId): RaidPick {
  return raid === 'toa' ? { raid, toa: { ...DEFAULT_TOA } } : { raid, modes: defaultModes(raid) };
}

const MODE_ORDER: Record<RaidModeId, number> = { entry: 0, normal: 1, cm: 2, hard: 3, expert: 4 };
const sortModes = (ms: RaidModeId[]) => [...new Set(ms)].sort((a, b) => MODE_ORDER[a] - MODE_ORDER[b]);

// ─── Reading ─────────────────────────────────────────────────────────────────────────────────

interface Tok {
  w: string;
  start: number;
  end: number;
}

// "4-man" before "4-" (at most) can claim it; clocks and "N+" / "N-" stay one token.
const TOKEN_RE = /\d+\s?-?\s?man\b|\d+(?::\d{1,2}){0,2}[+-]?|[a-z][a-z’']*|[,;/&]/gi;

function tokenize(text: string): Tok[] {
  const out: Tok[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    out.push({ w: m[0].toLowerCase().replace(/[’']/g, ''), start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

const BOUNDARY = new Set([',', ';', '/', '&', 'or', 'and', 'plus', 'then']);
const FILLER = new Set([
  'a', 'an', 'the', 'of', 'in', 'inside', 'within', 'its', 'their', 'with', 'mode', 'modes', 'any', 'either',
  'clear', 'clears', 'complete', 'completes', 'completion', 'completions', 'run', 'runs', 'kc', 'kills', 'on',
  'at', 'to', 'for', 'only', 'also', 'raid', 'raids', 'players', 'player', 'people', 'man', 'party', 'team',
  'size', 'must', 'be', 'is', 'from', 'times', 'x', 'do', 'get', 'least', 'more', 'need', 'needed',
]);

const RAID_WORDS: [string[], RaidId][] = [
  [['chambers', 'of', 'xeric'], 'cox'],
  [['theatre', 'of', 'blood'], 'tob'],
  [['theater', 'of', 'blood'], 'tob'],
  [['tombs', 'of', 'amascut'], 'toa'],
  [['the', 'fractured', 'archive'], 'tfa'],
  [['fractured', 'archive'], 'tfa'],
  [['raids', '4'], 'tfa'],
  [['raid', '4'], 'tfa'],
  [['cox'], 'cox'],
  [['chambers'], 'cox'],
  [['xeric'], 'cox'],
  [['olm'], 'cox'],
  [['tob'], 'tob'],
  [['theatre'], 'tob'],
  [['theater'], 'tob'],
  [['toa'], 'toa'],
  [['tombs'], 'toa'],
  [['tomb'], 'toa'],
  [['amascut'], 'toa'],
  [['tfa'], 'tfa'],
];

const PARTY_WORDS: Record<string, number> = { solo: 1, solos: 1, duo: 2, duos: 2, trio: 3, trios: 3, quad: 4, quads: 4 };
const CLOCK_UNITS = new Set(['m', 'min', 'mins', 'minute', 'minutes', 's', 'sec', 'secs', 'second', 'seconds', 'h', 'hr', 'hrs', 'hour', 'hours']);
const COUNT_WORDS = new Set(['kc', 'kill', 'kills', 'clear', 'clears', 'count', 'completion', 'completions', 'raids', 'raid', 'runs']);
const TEAMMATE_WORDS = new Set(['teammate', 'teammates', 'clanmate', 'clanmates', 'mate', 'mates']);

type Mod = { apply: (p: RaidPick) => string | null; tok: Tok[] };

function num(w: string | undefined): number | null {
  if (!w || !/^\d+$/.test(w)) return null;
  return parseInt(w, 10);
}

function clockSeconds(raw: string, unit: string | undefined): number | null {
  if (raw.includes(':')) {
    const parts = raw.split(':').map((p) => parseInt(p, 10));
    if (parts.some((p) => !Number.isFinite(p))) return null;
    return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = unit ?? 'm';
  return u.startsWith('h') ? n * 3600 : u.startsWith('s') ? n : n * 60;
}

/** What the box makes of what was typed. */
export function parseRaidQuery(text: string): RaidQueryResult {
  const toks = tokenize(text);
  const problems: RaidQueryProblem[] = [];
  const picks: RaidPick[] = [];
  // Which picks the next modifier lands on: the last raid named, or every raid after "any raid".
  let group: RaidPick[] = [];
  // Picks whose modes are still the default — the first mode word replaces them, later ones add.
  const explicit = new WeakSet<RaidPick>();
  let afterBoundary = false;
  let pending: Mod[] = [];
  let clears: number | null = null;
  let sawRaidWord = false;
  const tile: TileConditions = { v: 1 };

  const problem = (from: Tok, to: Tok, why: string) =>
    problems.push({ text: text.slice(from.start, to.end), start: from.start, end: to.end, why });

  const startGroup = (g: RaidPick[]) => {
    group = g;
    afterBoundary = false;
    const mods = pending;
    pending = [];
    for (const m of mods) runMod(m);
  };

  function runMod(m: Mod) {
    if (group.length === 0) {
      pending.push(m);
      return;
    }
    // Every raid in the group must take it, or none does: half-applying "scaled" to "any raid" would
    // be a guess about what was meant.
    const trial = group.map((p) => {
      const copy = structuredClone(p);
      if (explicit.has(p)) explicit.add(copy);
      return { p, copy };
    });
    for (const t of trial) {
      const why = m.apply(t.copy);
      if (why) {
        problem(m.tok[0], m.tok[m.tok.length - 1], why);
        return;
      }
    }
    for (const t of trial) Object.assign(t.p, t.copy);
  }

  const mod = (tok: Tok[], apply: (p: RaidPick) => string | null) => runMod({ tok, apply });

  const party = (bar: PartyBar) => (p: RaidPick): string | null => {
    const max = RAID_PARTY_MAX[p.raid];
    if (bar.n < 1) return 'A party needs at least 1 player.';
    if (bar.n > max) return `${RAID_NAME[p.raid]} takes at most ${max} players.`;
    p.party = bar;
    return null;
  };
  const toaLevel = (bar: Omit<ToaBar, 'entry'>) => (p: RaidPick): string | null => {
    if (p.raid !== 'toa') return `A raid level only works on ToA. ${RAID_NAME[p.raid]} goes by its modes.`;
    if (bar.min < 150) return 'ToA levels under 150 are Entry Mode: type “entry” instead.';
    if (bar.min > 600) return 'ToA goes up to raid level 600.';
    p.toa = { ...(p.toa ?? DEFAULT_TOA), min: bar.min, ...(bar.op && bar.op !== 'gte' ? { op: bar.op } : {}) };
    if (!bar.op || bar.op === 'gte') delete p.toa.op;
    return null;
  };
  // ToA party or level: a small number is a party, a big one a level (no party is bigger than 8).
  const partyOrLevel = (n: number, op: 'eq' | 'gte' | 'lte', forceLevel = false) => (p: RaidPick): string | null =>
    p.raid === 'toa' && (forceLevel || n > RAID_PARTY_MAX.toa) ? toaLevel({ min: n, op })(p) : party({ op, n })(p);

  const setMode = (p: RaidPick, mode: RaidModeId): string | null => {
    const opt = RAID_OPTIONS.find((r) => r.id === p.raid)!;
    if (p.raid === 'toa') {
      if (mode === 'entry') p.toa = { ...(p.toa ?? DEFAULT_TOA), entry: true };
      else if (mode === 'expert') p.toa = { ...(p.toa ?? DEFAULT_TOA), min: 300 };
      else if (mode === 'normal') p.toa = { ...(p.toa ?? DEFAULT_TOA), min: 150 };
      else return `ToA has no ${mode === 'cm' ? 'Challenge Mode' : 'Hard Mode'}.`;
      return null;
    }
    if (!opt.modes.some((m) => m.id === mode)) {
      const name = mode === 'entry' ? 'Entry Mode' : mode === 'cm' ? 'Challenge Mode' : mode === 'hard' ? 'Hard Mode' : 'Expert Mode';
      return `${RAID_NAME[p.raid]} has no ${name}.`;
    }
    // Entry on its own adds to the default modes ("tob entry" = every ToB mode, Entry too), as the
    // finder has always read it; any other mode word narrows to what was named.
    if (mode === 'entry' && !explicit.has(p)) p.modes = sortModes([...(p.modes ?? []), 'entry']);
    else {
      p.modes = explicit.has(p) ? sortModes([...(p.modes ?? []), mode]) : [mode];
      explicit.add(p);
    }
    return null;
  };

  /** A mode word: it names the raid it belongs to unless that raid is the one being described. */
  const modeWord = (tok: Tok[], mode: RaidModeId, implies: RaidId | null) => {
    const here = group.find((p) => (implies ? p.raid === implies : true));
    if (here && (!afterBoundary || !implies) && group.length === 1) {
      const why = setMode(here, mode);
      if (why) problem(tok[0], tok[tok.length - 1], why);
      afterBoundary = false;
      return;
    }
    if (group.length > 1 && !afterBoundary) {
      // "any raid hm": the mode narrows the raid it belongs to inside the group.
      const target = implies ? group.find((p) => p.raid === implies) : null;
      if (target) {
        const why = setMode(target, mode);
        if (why) problem(tok[0], tok[tok.length - 1], why);
        return;
      }
    }
    if (!implies) {
      problem(tok[0], tok[tok.length - 1], mode === 'entry' ? 'Say which raid: “tob entry” or “toa entry”.' : 'Say which raid this mode is for.');
      return;
    }
    const p = newPick(implies);
    picks.push(p);
    sawRaidWord = true;
    startGroup([p]);
    setMode(p, mode);
  };

  let i = 0;
  const w = (k: number) => toks[i + k]?.w;
  const seq = (...ws: string[]) => ws.every((x, k) => w(k) === x);

  while (i < toks.length) {
    const t = toks[i];

    if (BOUNDARY.has(t.w)) {
      afterBoundary = true;
      i++;
      continue;
    }

    // ── Raids ──
    const raid = RAID_WORDS.find(([ws]) => seq(...ws));
    if (raid) {
      const p = newPick(raid[1]);
      picks.push(p);
      sawRaidWord = true;
      startGroup([p]);
      i += raid[0].length;
      continue;
    }
    if ((seq('any', 'raid') || seq('any', 'raids') || seq('all', 'raids') || seq('every', 'raid')) && w(2) !== '4') {
      const g = RAID_OPTIONS.map((r) => newPick(r.id));
      picks.push(...g);
      sawRaidWord = true;
      startGroup(g);
      i += 2;
      continue;
    }

    // ── Modes ──
    if (seq('challenge', 'time') || seq('challenge', 'times') || t.w === 'ct') {
      const n = t.w === 'ct' ? 1 : 2;
      mod(toks.slice(i, i + n), (p) => {
        const offers = raidOffers(p.raid, p.modes ?? []);
        if (!offers.challenge) {
          return p.raid === 'cox' ? 'The challenge time is a Challenge Mode thing: Normal CoX has none.'
            : p.raid === 'tob' ? 'The challenge time is a Hard Mode thing: Normal and Entry ToB have none.'
            : `${RAID_NAME[p.raid]} has no challenge time. Use “under 25:00” for a time.`;
        }
        // Only the challenge mode has the time, so the raid's other modes could never count.
        if (!explicit.has(p)) p.modes = [p.raid === 'cox' ? 'cm' : 'hard'];
        p.challenge = true;
        return null;
      });
      i += n;
      continue;
    }
    if (seq('challenge', 'mode') || t.w === 'cm' || t.w === 'cms' || t.w === 'cmode') {
      const n = seq('challenge', 'mode') ? 2 : 1;
      modeWord(toks.slice(i, i + n), 'cm', 'cox');
      i += n;
      continue;
    }
    if (seq('hard', 'mode') || t.w === 'hm' || t.w === 'hmt' || t.w === 'hard') {
      const n = seq('hard', 'mode') ? 2 : 1;
      modeWord(toks.slice(i, i + n), 'hard', 'tob');
      i += n;
      continue;
    }
    if (seq('expert', 'mode') || t.w === 'expert' || t.w === 'exp') {
      const n = seq('expert', 'mode') ? 2 : 1;
      modeWord(toks.slice(i, i + n), 'expert', 'toa');
      i += n;
      continue;
    }
    if (t.w === 'entry') {
      modeWord([t], 'entry', null);
      i++;
      continue;
    }
    if (t.w === 'normal' || t.w === 'regular' || t.w === 'normals') {
      modeWord([t], 'normal', null);
      i++;
      continue;
    }

    // ── The whole tile ──
    if (t.w === 'deathless' || t.w === 'flawless' || seq('no', 'deaths') || seq('no', 'death') || seq('nobody', 'dies') || seq('no', 'one', 'dies') || seq('noone', 'dies') || seq('without', 'dying') || seq('without', 'deaths') || seq('0', 'deaths') || seq('zero', 'deaths')) {
      tile.noDeaths = true;
      i += t.w === 'deathless' || t.w === 'flawless' ? 1 : seq('no', 'one', 'dies') ? 3 : 2;
      continue;
    }
    if (seq('whole', 'team') || seq('full', 'team') || seq('all', 'teammates') || seq('team', 'only') || seq('only', 'teammates') || seq('everyone', 'on', 'the', 'team')) {
      tile.mates = { all: true };
      i += seq('everyone', 'on', 'the', 'team') ? 4 : 2;
      continue;
    }
    {
      // "with 3 teammates", "3 teammates", "3 team mates": the player and that many more.
      const k = w(0) === 'with' ? 1 : 0;
      const n = num(w(k));
      const mates = TEAMMATE_WORDS.has(w(k + 1) ?? '') ? 2 : w(k + 1) === 'team' && (w(k + 2) === 'mates' || w(k + 2) === 'mate') ? 3 : 0;
      if (n != null && mates) {
        tile.mates = { min: n + 1 };
        i += k + mates;
        continue;
      }
    }
    if (seq('counted', 'once') || seq('count', 'once') || seq('counts', 'once') || seq('once', 'per', 'raid') || t.w === 'together' || t.w === 'shared') {
      tile.shared = 'together';
      i += seq('once', 'per', 'raid') ? 3 : t.w === 'together' || t.w === 'shared' ? 1 : 2;
      continue;
    }
    if (t.w === 'first' || t.w === 'firsts') {
      const n = num(w(1));
      if (n != null && n > 0) {
        tile.startCount = { op: 'lt', n };
        if (clears == null) clears = n;
        i += 2;
      } else {
        tile.startCount = { op: 'lt', n: 1 };
        i++;
      }
      continue;
    }
    {
      // "under 5 kc" / "fewer than 5 kc" / "over 50 kc" / "more than 50 kc" / "50+ kc".
      const under = t.w === 'under' || t.w === 'below' || seq('fewer', 'than') || seq('less', 'than');
      const over = t.w === 'over' || t.w === 'above' || seq('more', 'than');
      const k = seq('fewer', 'than') || seq('less', 'than') || seq('more', 'than') ? 2 : 1;
      if ((under || over) && num(w(k)) != null && COUNT_WORDS.has(w(k + 1) ?? '')) {
        tile.startCount = { op: under ? 'lt' : 'gt', n: num(w(k))! };
        i += k + 2;
        continue;
      }
      if (over && num(w(k)) != null) {
        // "over 50" on its own: nothing about a raid is "over" a number but the count at the start.
        tile.startCount = { op: 'gt', n: num(w(k))! };
        i += k + 1;
        continue;
      }
    }

    // ── Per raid ──
    {
      // "under 25:00", "sub 30", "in under 45 minutes", "faster than 20".
      const k = seq('in', 'under') || seq('faster', 'than') ? 2 : t.w === 'under' || t.w === 'sub' || t.w === 'below' ? 1 : 0;
      const raw = k ? w(k) : undefined;
      if (raw && /^\d+(?::\d{1,2}){0,2}$/.test(raw)) {
        const unit = CLOCK_UNITS.has(w(k + 1) ?? '') ? w(k + 1) : undefined;
        const sec = clockSeconds(raw, unit);
        const n = k + 1 + (unit ? 1 : 0);
        const span = toks.slice(i, i + n);
        if (sec == null || sec <= 0) problem(span[0], span[span.length - 1], 'That is not a time. Try “under 25:00”.');
        else mod(span, (p) => ((p.under = sec), null));
        i += n;
        continue;
      }
    }
    if (PARTY_WORDS[t.w]) {
      mod([t], party({ op: 'eq', n: PARTY_WORDS[t.w] }));
      i++;
      continue;
    }
    {
      // "4 man", "4-man", "4man".
      const m = /^(\d+)\s?-?\s?man$/.exec(t.w);
      const joined = num(t.w) != null && (w(1) === 'man' || w(1) === 'players' || w(1) === 'player' || w(1) === 'people');
      if (m || joined) {
        const n = m ? parseInt(m[1], 10) : num(t.w)!;
        const span = toks.slice(i, i + (m ? 1 : 2));
        mod(span, party({ op: 'eq', n }));
        i += span.length;
        continue;
      }
    }
    if (seq('scaled', 'to') || seq('scale', 'to') || t.w === 'scaled' || t.w === 'scale') {
      const k = w(1) === 'to' ? 2 : 1;
      const raw = w(k);
      const n = raw ? num(raw.replace(/\+$/, '')) : null;
      if (n == null) {
        problem(t, toks[i + k - 1] ?? t, 'Say the size: “scaled 10”.');
        i += k;
        continue;
      }
      mod(toks.slice(i, i + k + 1), (p) => {
        if (p.raid !== 'cox') return `“scaled” only works on CoX. ${RAID_NAME[p.raid]} has no scale.`;
        if (n < 1 || n > RAID_PARTY_MAX.cox) return `CoX scales from 1 to ${RAID_PARTY_MAX.cox}.`;
        p.scale = n;
        return null;
      });
      i += k + 1;
      continue;
    }
    if (seq('up', 'to') || seq('at', 'most') || seq('at', 'least') || t.w === 'exactly' || t.w === 'max') {
      const k = t.w === 'exactly' || t.w === 'max' ? 1 : 2;
      const n = num(w(k));
      if (n != null) {
        const op = t.w === 'exactly' ? 'eq' : seq('at', 'least') ? 'gte' : 'lte';
        let n2 = k + 1;
        while (['players', 'player', 'man', 'people'].includes(w(n2) ?? '')) n2++;
        const span = toks.slice(i, i + n2);
        mod(span, partyOrLevel(n, op));
        i += n2;
        continue;
      }
    }
    if (t.w === 'invo' || t.w === 'invocation' || t.w === 'invocations' || t.w === 'level' || t.w === 'lvl' || seq('raid', 'level')) {
      const k = seq('raid', 'level') ? 2 : 1;
      const m = /^(\d+)([+-]?)$/.exec(w(k) ?? '');
      if (m) {
        const n = parseInt(m[1], 10);
        const { op, used } = levelTail(m[2], k + 1);
        const span = toks.slice(i, i + used);
        mod(span, toaLevel({ min: n, op }));
        i += used;
        continue;
      }
    }
    {
      const m = /^(\d+)([+-]?)$/.exec(t.w);
      if (m) {
        const n = parseInt(m[1], 10);
        // "5 kc", "5 clears", "5 raids" anywhere: the clears needed.
        if (!m[2] && COUNT_WORDS.has(w(1) ?? '') && w(1) !== 'count' && !(w(1) === 'raids' && w(2) === '4')) {
          if (clears == null) clears = n;
          else problem(t, toks[i + 1], 'The clears needed were already set.');
          i += 2;
          continue;
        }
        const { op, used, said } = levelTail(m[2], 1);
        // A plain number before any raid is the clears needed ("5 cm", "10 toa 300+").
        if (!m[2] && !said && picks.length === 0 && pending.length === 0 && clears == null) {
          clears = n;
          i++;
          continue;
        }
        const span = toks.slice(i, i + used);
        // "4+" / "4-" / "4 or more" is a party (or a ToA level when big); a bare number after a raid
        // means a ToA level and nothing anywhere else.
        if (!m[2] && !said) {
          mod(span, (p) => {
            if (p.raid === 'toa' && n > RAID_PARTY_MAX.toa) return toaLevel({ min: n, op: 'gte' })(p);
            return `What is ${n}? Say “${n}+” or “${n} man” for a party, or put the clears needed first.`;
          });
        } else {
          mod(span, partyOrLevel(n, op ?? 'gte'));
        }
        i += used;
        continue;
      }
    }

    if (FILLER.has(t.w)) {
      i++;
      continue;
    }
    problem(t, t, wordProblem(t.w));
    i++;
  }

  // "Between" helper for ToA levels and parties: "300+", "300-", "300 or higher", "300 exact".
  function levelTail(sign: string, from: number): { op: 'gte' | 'lte' | 'eq' | undefined; used: number; said: boolean } {
    if (sign === '+') return { op: 'gte', used: from + skipPlayers(from), said: true };
    if (sign === '-') return { op: 'lte', used: from + skipPlayers(from), said: true };
    const a = w(from);
    const b = w(from + 1);
    if (a === 'or' && (b === 'higher' || b === 'more' || b === 'above' || b === 'over')) return { op: 'gte', used: from + 2, said: true };
    if (a === 'or' && (b === 'lower' || b === 'less' || b === 'below' || b === 'under' || b === 'fewer')) return { op: 'lte', used: from + 2, said: true };
    if (a === 'exact' || a === 'exactly' || a === 'only') return { op: 'eq', used: from + 1, said: true };
    if (a === 'plus') return { op: 'gte', used: from + 1, said: true };
    return { op: undefined, used: from, said: false };
  }
  function skipPlayers(from: number): number {
    let k = 0;
    while (['players', 'player', 'man', 'people'].includes(w(from + k) ?? '')) k++;
    return k;
  }

  // "5 raids solo": "raids" named no raid in particular, so it means any of them.
  if (picks.length === 0 && (sawRaidWord || toks.some((t) => t.w === 'raid' || t.w === 'raids'))) {
    const g = RAID_OPTIONS.map((r) => newPick(r.id));
    picks.push(...g);
    startGroup(g);
  }
  for (const m of pending) problem(m.tok[0], m.tok[m.tok.length - 1], 'Name a raid for this to go with.');

  if (picks.length > 0) tile.raids = picks.map(cleanPick);
  return { clears, conditions: tile, problems };
}

function wordProblem(word: string): string {
  if (['chest', 'purple', 'kit', 'dust', 'pet', 'unique', 'drop', 'loot'].includes(word)) return `“${word}” is a drop: make it an item tile instead.`;
  if (word === 'timed' || word === 'speed' || word === 'pb') return 'Give the time: “under 25:00”.';
  return `“${word}” isn’t a raid word this box knows.`;
}

/** A pick with only the fields that say something, in one order (so drafts compare equal). */
export function cleanPick(p: RaidPick): RaidPick {
  const out: RaidPick = { raid: p.raid };
  if (p.raid === 'toa') {
    const bar = p.toa ?? DEFAULT_TOA;
    out.toa = { min: bar.min, entry: !!bar.entry, ...(bar.op && bar.op !== 'gte' ? { op: bar.op } : {}) };
  } else {
    out.modes = sortModes(p.modes?.length ? p.modes : defaultModes(p.raid));
  }
  if (p.under != null) out.under = p.under;
  if (p.challenge) out.challenge = true;
  if (p.party) out.party = { op: p.party.op, n: p.party.n };
  if (p.scale != null && p.raid === 'cox') out.scale = p.scale;
  return out;
}

// ─── Writing back ────────────────────────────────────────────────────────────────────────────

function sameSet(a: RaidModeId[], b: RaidModeId[]): boolean {
  return a.length === b.length && a.every((m) => b.includes(m));
}

const MODE_WORD: Record<RaidModeId, string> = { entry: 'entry', normal: 'normal', cm: 'cm', hard: 'hm', expert: 'expert' };

/** The words one pick is typed as. */
export function pickQueryText(p: RaidPick): string {
  const out: string[] = [p.raid];
  if (p.raid === 'toa') {
    const bar = p.toa ?? DEFAULT_TOA;
    const op = bar.op ?? 'gte';
    if (!(bar.min === 150 && op === 'gte')) out.push(op === 'eq' ? `exactly ${bar.min}` : op === 'lte' ? `up to ${bar.min}` : `${bar.min}+`);
    if (bar.entry) out.push('entry');
  } else if (p.raid !== 'tfa') {
    const modes = sortModes(p.modes ?? []);
    const defaults = defaultModes(p.raid);
    if (sameSet(modes, defaults)) {
      // just the raid
    } else if (sameSet(modes, [...defaults, 'entry'])) {
      out.push('entry');
    } else {
      // Name the non-Entry modes first: that narrows; Entry then adds.
      const named = modes.filter((m) => m !== 'entry');
      if (named.length === 0) out.push('entry', 'only');
      else out.push(...named.map((m) => MODE_WORD[m]), ...(modes.includes('entry') ? ['entry'] : []));
    }
  }
  if (p.party) {
    const { op, n } = p.party;
    out.push(op === 'eq' ? (n === 1 ? 'solo' : n === 2 ? 'duo' : n === 3 ? 'trio' : `${n} man`) : op === 'gte' ? `${n}+` : `up to ${n} players`);
  }
  if (p.scale != null && p.raid === 'cox') out.push(`scaled ${p.scale}`);
  if (p.under != null) out.push(`under ${clockWords(p.under)}`);
  if (p.challenge) out.push('challenge time');
  return out.join(' ');
}

/** The tile written as the box reads it: parseRaidQuery(raidQueryText(c, n)) gives c and n back. */
export function raidQueryText(c: TileConditions, clears: number | null): string {
  const parts: string[] = [];
  const picks = (c.raids ?? []).map(pickQueryText);
  if (picks.length) parts.push((clears != null ? `${clears} ` : '') + picks.join(', '));
  else if (clears != null) parts.push(String(clears));
  if (c.noDeaths) parts.push('deathless');
  if (c.mates && 'all' in c.mates) parts.push('whole team');
  else if (c.mates) parts.push(`with ${Math.max(0, c.mates.min - 1)} teammates`);
  if (c.shared === 'together') parts.push('counted once');
  if (c.startCount) parts.push(startCountText(c.startCount));
  return parts.join(', ');
}

function startCountText(s: StartCount): string {
  if (s.op === 'lt') return s.n === 1 ? 'first' : `under ${s.n} kc`;
  return `over ${s.n} kc`;
}

// ─── Words for the pills ─────────────────────────────────────────────────────────────────────

export type PillKey = 'modes' | 'party' | 'scale' | 'under' | 'challenge';

/** One raid's pills: its mode / level first, then each bar it carries. */
export function pickPills(p: RaidPick): { key: PillKey; label: string; removable: boolean }[] {
  const out: { key: PillKey; label: string; removable: boolean }[] = [];
  if (p.raid === 'toa') {
    const bar = p.toa ?? DEFAULT_TOA;
    const op = bar.op ?? 'gte';
    const lvl = op === 'eq' ? `level ${bar.min} exactly` : op === 'lte' ? `level ${bar.min} or lower` : `${bar.min}+`;
    out.push({ key: 'modes', label: bar.entry ? `${lvl} or Entry` : lvl, removable: false });
  } else if (p.raid !== 'tfa') {
    const modes = sortModes(p.modes ?? []);
    const opt = RAID_OPTIONS.find((r) => r.id === p.raid)!;
    const label = sameSet(modes, defaultModes(p.raid))
      ? 'Any mode but Entry'
      : modes.map((m) => (m === 'cm' ? 'Challenge Mode' : m === 'hard' ? 'Hard Mode' : opt.modes.find((x) => x.id === m)!.label)).join(' or ');
    out.push({ key: 'modes', label, removable: false });
  }
  if (p.party) out.push({ key: 'party', label: p.party.op === 'eq' ? (p.party.n === 1 ? 'solo' : `exactly ${p.party.n} players`) : p.party.op === 'gte' ? `${p.party.n}+ players` : `up to ${p.party.n} players`, removable: true });
  if (p.scale != null && p.raid === 'cox') out.push({ key: 'scale', label: `scaled to ${p.scale}+`, removable: true });
  if (p.under != null) out.push({ key: 'under', label: `under ${clockWords(p.under)}`, removable: true });
  if (p.challenge) out.push({ key: 'challenge', label: 'in the challenge time', removable: true });
  return out;
}

export type TilePillKey = 'noDeaths' | 'mates' | 'shared' | 'startCount';

export function tilePills(c: TileConditions): { key: TilePillKey; label: string }[] {
  const out: { key: TilePillKey; label: string }[] = [];
  if (c.noDeaths) out.push({ key: 'noDeaths', label: 'nobody dies' });
  if (c.mates && 'all' in c.mates) out.push({ key: 'mates', label: 'everyone on the team' });
  else if (c.mates) out.push({ key: 'mates', label: `${c.mates.min}+ of the team inside` });
  if (c.shared === 'together') out.push({ key: 'shared', label: 'counted once per raid' });
  if (c.startCount) out.push({ key: 'startCount', label: startCountLabel(c.startCount) });
  return out;
}

export function startCountLabel(s: StartCount): string {
  if (s.op === 'lt') return s.n === 1 ? 'first-timers only' : `under ${s.n} at the start`;
  return `over ${s.n} at the start`;
}

/** The challenge time hint for a suggestion: "25:00 for 5 · 1:10:00 solo". */
export function challengeHint(raid: RaidId): string | null {
  const mode: RaidModeId = raid === 'cox' ? 'cm' : 'hard';
  const big = 5;
  const a = challengeSeconds(raid, mode, big);
  const b = challengeSeconds(raid, mode, 1);
  if (a == null || b == null) return null;
  return `${clockWords(a)} for ${big} · ${clockWords(b)} solo`;
}

// ─── Suggestions while typing ────────────────────────────────────────────────────────────────

export interface RaidSuggestion {
  /** What replaces the word being typed. */
  insert: string;
  note: string;
}

const VOCAB: { insert: string; note: string; when?: (p: RaidPick | null) => boolean }[] = [
  { insert: 'cox', note: 'Chambers of Xeric' },
  { insert: 'cm', note: 'CoX Challenge Mode' },
  { insert: 'tob', note: 'Theatre of Blood' },
  { insert: 'hm', note: 'ToB Hard Mode' },
  { insert: 'toa', note: 'Tombs of Amascut' },
  { insert: 'tfa', note: 'The Fractured Archive' },
  { insert: 'any raid', note: 'all four raids' },
  { insert: 'entry', note: 'Entry Mode counts too', when: (p) => !!p && (p.raid === 'tob' || p.raid === 'toa') },
  { insert: 'expert', note: 'ToA 300+', when: (p) => !p || p.raid === 'toa' },
  { insert: '300+', note: 'raid level 300 or higher', when: (p) => p?.raid === 'toa' },
  { insert: 'exactly 300', note: 'raid level 300 only', when: (p) => p?.raid === 'toa' },
  { insert: 'up to 300', note: 'raid level 300 or lower', when: (p) => p?.raid === 'toa' },
  { insert: 'challenge time', note: '', when: (p) => !!p && (p.raid === 'cox' || p.raid === 'tob') },
  { insert: 'under 30:00', note: 'a time to beat', when: (p) => !!p },
  { insert: 'solo', note: 'party of 1', when: (p) => !!p },
  { insert: 'duo', note: 'party of 2', when: (p) => !!p },
  { insert: 'trio', note: 'party of 3', when: (p) => !!p },
  { insert: '4+', note: '4 or more players', when: (p) => !!p },
  { insert: 'scaled to 10', note: 'CoX only', when: (p) => p?.raid === 'cox' },
  { insert: 'deathless', note: 'nobody in the party dies' },
  { insert: 'no deaths', note: 'nobody in the party dies' },
  { insert: 'with 2 teammates', note: 'from their own team' },
  { insert: 'whole team', note: 'everyone inside on the team' },
  { insert: 'counted once', note: 'one clear, however many teammates' },
  { insert: 'first', note: 'first-timers only' },
  { insert: 'under 5 kc', note: 'count when the event starts' },
  { insert: 'over 50 kc', note: 'count when the event starts' },
];

/**
 * Words that could finish what is being typed, for the box's suggestion list. Only what the raid
 * being described can take is offered (no "scaled" on ToB, no challenge time without CM / HM).
 */
export function raidQuerySuggestions(text: string, limit = 5): RaidSuggestion[] {
  const m = /([a-z0-9:+]+(?:\s[a-z]+)?)$/i.exec(text);
  if (!m || /\s$/.test(text)) return [];
  // The last word, or the last two when they could start a phrase ("challenge ti", "no de").
  const last = text.slice(text.search(/\S+$/)).toLowerCase();
  const lastTwo = (/(\S+\s+\S+)$/.exec(text)?.[1] ?? '').toLowerCase();
  const before = text.slice(0, text.length - last.length);
  const res = parseRaidQuery(before);
  const picks = res.conditions.raids ?? [];
  const current = picks.length ? picks[picks.length - 1] : null;
  const out: RaidSuggestion[] = [];
  // A phrase the last two words start ("no de" → "no deaths") ranks above one the last word alone does.
  const two = (v: (typeof VOCAB)[number]) => lastTwo.includes(' ') && v.insert.startsWith(lastTwo) && v.insert !== lastTwo;
  const ranked = [...VOCAB.filter(two), ...VOCAB.filter((v) => !two(v) && v.insert.startsWith(last) && v.insert !== last)];
  for (const v of ranked) {
    if (v.when && !v.when(current)) continue;
    if (v.insert === 'challenge time' && current && !raidOffers(current.raid, current.modes ?? []).challenge && current.raid !== 'cox' && current.raid !== 'tob') continue;
    const note = v.insert === 'challenge time' && current ? challengeHint(current.raid) ?? '' : v.note;
    out.push({ insert: v.insert, note });
    if (out.length >= limit) break;
  }
  return out;
}

/** The text with the word being typed swapped for a suggestion, ready for the next word. */
export function applySuggestion(text: string, s: RaidSuggestion): string {
  const lastTwo = /(\S+\s+\S+)$/.exec(text)?.[1]?.toLowerCase() ?? '';
  const cut = lastTwo.includes(' ') && s.insert.startsWith(lastTwo) ? lastTwo.length : (text.match(/\S+$/)?.[0].length ?? 0);
  return `${text.slice(0, text.length - cut)}${s.insert} `;
}

// ─── To a tile ───────────────────────────────────────────────────────────────────────────────

/** A pick as the raid picker's mode keys ("tob:hard"). ToA: 150+ = Normal + Expert, 300+ = Expert. */
export function pickSelection(p: RaidPick): RaidSelection | null {
  const sel: RaidSelection = {};
  if (p.raid === 'toa') {
    const bar = p.toa ?? DEFAULT_TOA;
    if ((bar.op ?? 'gte') !== 'gte' || (bar.min !== 150 && bar.min !== 300)) return null;
    if (bar.min === 150) sel[raidModeKey('toa', 'normal')] = true;
    sel[raidModeKey('toa', 'expert')] = true;
    if (bar.entry) sel[raidModeKey('toa', 'entry')] = true;
    return sel;
  }
  for (const m of p.modes ?? []) sel[raidModeKey(p.raid, m)] = true;
  return sel;
}

/** The picks a raid-picker selection means (one per raid, no bars). */
export function picksFromSelection(sel: RaidSelection): RaidPick[] {
  const out: RaidPick[] = [];
  for (const r of RAID_OPTIONS) {
    const on = r.modes.filter((m) => sel[raidModeKey(r.id, m.id)]).map((m) => m.id);
    if (on.length === 0) continue;
    if (r.id === 'toa') {
      const entry = on.includes('entry');
      const min = on.includes('normal') ? 150 : on.includes('expert') ? 300 : 0;
      // Entry alone: nothing at 150 or above counts, which a level bar can only say as "up to 0".
      out.push({ raid: 'toa', toa: min ? { min, entry } : { min: 0, entry, op: 'lte' } });
    } else {
      out.push({ raid: r.id, modes: on });
    }
  }
  return out;
}

/** True when the tile is just raids and modes: the plain tile the hiscores (or Entry's count line) carry. */
export function isPlainRaidTile(c: TileConditions): boolean {
  const { v: _v, raids, ...rest } = c;
  void _v;
  if (Object.values(rest).some((x) => x != null && x !== false && x !== 'each')) return false;
  return (raids ?? []).every((p) => p.under == null && !p.challenge && !p.party && p.scale == null && pickSelection(p) != null);
}

export interface RaidConditionsTile {
  ok: boolean;
  error?: string;
  /** 'raid' = judged on the site from the plugin's raid facts; else the plain tile raidTileConfig makes. */
  source: 'hiscores' | 'plugin' | 'raid' | null;
  title: string;
  titleOne: string;
  titleTemplate: string;
  config: Partial<TileConfig>;
  /** The selection the plain tile was made from, when it is one. */
  selection?: RaidSelection;
}

/**
 * The tile a raid draft becomes. No conditions at all: exactly the tile the raid picker always made
 * (raidTileConfig — the hiscores, or the plugin's count lines when Entry is in). Any condition: a
 * 'raid' tile carrying them, judged on the site.
 */
export function raidConditionsTile(c: TileConditions, clears: number | null): RaidConditionsTile {
  const n = clears && clears > 0 ? clears : 1;
  const picks = c.raids ?? [];
  if (picks.length === 0) return { ok: false, error: 'Name at least one raid.', source: null, title: 'Raids', titleOne: 'Raid', titleTemplate: '{n} raids', config: {} };
  if (isPlainRaidTile(c)) {
    const sel: RaidSelection = {};
    for (const p of picks) Object.assign(sel, pickSelection(p));
    const res = raidTileConfig(sel, n);
    if (!res.ok) return { ok: false, error: res.error, source: null, title: res.title, titleOne: res.title, titleTemplate: res.title, config: {} };
    return {
      ok: true,
      source: res.source,
      title: res.title,
      titleOne: raidTileConfig(sel, 1).title,
      titleTemplate: raidTileConfig(sel, 2).title.replace(/^2 /, '{n} '),
      config: res.config,
      selection: sel,
    };
  }
  for (const p of picks) {
    if (p.raid !== 'toa' && (p.modes ?? []).length === 0) return { ok: false, error: `Pick at least one ${RAID_NAME[p.raid]} mode.`, source: null, title: '', titleOne: '', titleTemplate: '', config: {} };
  }
  const conditions = normalizeConditions(c);
  const names = picks.map((p) => pickTitle(p));
  const lead = [...new Set(names)].join(' or ');
  const tail = c.startCount?.op === 'lt' && c.startCount.n === 1 ? ', first-timers' : c.noDeaths ? ', deathless' : '';
  return {
    ok: true,
    source: 'raid',
    title: n > 1 ? `${n} × ${lead}${tail}` : `${lead}${tail}`,
    titleOne: `${lead}${tail}`,
    titleTemplate: `{n} × ${lead}${tail}`,
    config: { tileType: 'raid', requiredAmount: n, conditions },
  };
}

/** A pick's short name for a tile title: "solo CoX", "ToB HM", "ToA 300+". */
export function pickTitle(p: RaidPick): string {
  let name = RAID_NAME[p.raid];
  if (p.raid === 'toa') {
    const bar = p.toa ?? DEFAULT_TOA;
    const op = bar.op ?? 'gte';
    if (!(bar.min === 150 && op === 'gte')) name += op === 'eq' ? ` ${bar.min}` : op === 'lte' ? ` ≤${bar.min}` : ` ${bar.min}+`;
    if (bar.entry) name += ' (Entry too)';
  } else if (p.raid !== 'tfa') {
    const modes = sortModes(p.modes ?? []);
    if (!sameSet(modes, defaultModes(p.raid))) name += ` ${modes.map((m) => (m === 'cm' ? 'CM' : m === 'hard' ? 'HM' : m === 'entry' ? 'Entry' : 'Normal')).join('/')}`;
  }
  if (p.party?.op === 'eq' && p.party.n <= 3) name = `${p.party.n === 1 ? 'Solo' : p.party.n === 2 ? 'Duo' : 'Trio'} ${name}`;
  return name;
}

/** Conditions as stored: empty rules dropped, picks in their one shape. */
export function normalizeConditions(c: TileConditions): TileConditions {
  const out: TileConditions = { v: 1 };
  if (c.raids?.length) out.raids = c.raids.map(cleanPick);
  if (c.noDeaths) out.noDeaths = true;
  if (c.mates) out.mates = 'all' in c.mates ? { all: true } : { min: c.mates.min };
  if (c.shared === 'together') out.shared = 'together';
  if (c.startCount) out.startCount = { op: c.startCount.op, n: c.startCount.n };
  if (c.toaLevel) out.toaLevel = { min: c.toaLevel.min, entry: !!c.toaLevel.entry, ...(c.toaLevel.op && c.toaLevel.op !== 'gte' ? { op: c.toaLevel.op } : {}) };
  return out;
}

/** True when nothing is set beyond the version. */
export function conditionsEmpty(c: TileConditions | null | undefined): boolean {
  if (!c) return true;
  const n = normalizeConditions(c);
  return Object.keys(n).length === 1;
}

/** A raid draft from a plain selection (the finder's seed), so the box opens on what was matched. */
export function conditionsFromSelection(sel: RaidSelection | undefined, fallback: RaidId[] = ['cox', 'tob']): TileConditions {
  const picks = picksFromSelection(sel ?? defaultRaidSelection(fallback));
  return { v: 1, raids: picks };
}

/**
 * A tile title with its start-count rule said: "First TzKal-Zuk" for a single first, else the title
 * with ", as a first" / ", under 5 at the start" / ", over 50 at the start" after it.
 */
export function titleWithStartCount(title: string, noun: string, amount: number | null, sc: StartCount | null | undefined): string {
  if (!sc) return title;
  if (sc.op === 'lt' && sc.n === 1) return (amount ?? 1) <= 1 ? `First ${noun}` : `${title}, as a first`;
  return `${title}, ${sc.op === 'lt' ? 'under' : 'over'} ${sc.n} at the start`;
}
