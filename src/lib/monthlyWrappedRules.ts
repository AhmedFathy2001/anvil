// Monthly Wrapped, the pure half: one character's calendar month, from what the account already
// records — daily stat rows, milestones, collection-log unlocks, PBs and the drops the plugin saw.
// lib/monthlyWrapped loads the inputs.
//
// Everything here belongs to the ACCOUNT, not a clan seat, so a player with no clan gets the same card.
// Months are UTC calendar months, like every other month on the site (lib/monthWindow).

import { BOSSES } from '@/lib/constants';
import { bossImageUrl, itemIconUrl } from '@/lib/tileIcons';
import { cardHours, shortNumber } from '@/lib/eventWrappedRules';

export interface MonthDayRow {
  xpGained: number;
  ehpMilliGained: number;
  ehbMilliGained: number;
  /** lib/statDeltas JSON: { skills?: {key: xp}, bosses?: {key: kc}, levels?: {key: level} }. */
  deltas: string | null;
}

export interface MonthMilestoneRow {
  kind: string;
  metric: string | null;
  threshold: number;
}

export interface MonthClogRow {
  itemId: number;
  itemName: string;
  pageName: string;
}

export interface MonthPbRow {
  activity: string;
  teamSize: number;
  centis: number;
}

export interface MonthMomentRow {
  kind: string;
  itemId: number | null;
  itemName: string | null;
  valueGp: number | null;
  source: string | null;
}

export interface MonthItem {
  itemId: number | null;
  itemName: string;
  /** 1-in-N where the drop dataset knows it. */
  denominator: number | null;
  source: string | null;
  valueGp: number | null;
}

export interface MonthlyWrapped {
  rsn: string;
  monthKey: string;
  monthLabel: string;
  /** True while the month is still running: the card says "so far". */
  inProgress: boolean;
  xpGained: number;
  kcGained: number;
  /** Efficient hours gained, from the daily rows' EHP/EHB. */
  ehpGained: number;
  ehbGained: number;
  daysActive: number;
  topSkills: { key: string; name: string; xp: number }[];
  topBosses: { key: string; name: string; kc: number }[];
  /** Skills that reached 99 this month. */
  maxed: string[];
  /** Other thresholds crossed: "1,000 Vorkath KC", "50M XP in Slayer", "250M total XP". */
  milestones: string[];
  newSlots: number;
  /** The new log slots, rarest first. */
  slots: MonthItem[];
  pets: MonthItem[];
  biggestDrop: MonthItem | null;
  pbs: { activity: string; teamSize: number; time: string }[];
}

const skillName = (key: string) => key.charAt(0).toUpperCase() + key.slice(1);
const bossName = (key: string) => BOSSES.find((b) => b.key === key)?.label ?? key;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function isMonthKey(key: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(key)) return false;
  const m = Number(key.slice(5));
  return m >= 1 && m <= 12;
}

export function monthKeyOf(when: Date): string {
  return `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** "October 2026". */
export function monthLabel(key: string): string {
  return `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
}

/** The month after `key`, as a key. December rolls the year. */
export function nextMonthKey(key: string): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
}

export function previousMonthKeyOf(key: string): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** A PB time as the game shows it: 1:23.40, or 1:02:03.00 past the hour. */
export function pbTime(centis: number): string {
  const total = Math.max(0, Math.round(centis));
  const cs = total % 100;
  const s = Math.floor(total / 100) % 60;
  const m = Math.floor(total / 6000) % 60;
  const h = Math.floor(total / 360000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}.${pad(cs)}` : `${m}:${pad(s)}.${pad(cs)}`;
}

function parseDeltas(json: string | null): { skills?: Record<string, number>; bosses?: Record<string, number> } {
  if (!json) return {};
  try {
    return JSON.parse(json) ?? {};
  } catch {
    return {};
  }
}

function milestoneLine(m: MonthMilestoneRow): string | null {
  switch (m.kind) {
    case 'kc':
      return m.metric ? `${m.threshold.toLocaleString('en-US')} ${bossName(m.metric)} KC` : null;
    case 'xp':
      return m.metric ? `${shortNumber(m.threshold)} ${skillName(m.metric)} XP` : null;
    case 'totalxp':
      return `${m.threshold.toLocaleString('en-US')}M total XP`;
    case 'ehp':
      return `${m.threshold.toLocaleString('en-US')} EHP`;
    case 'ehb':
      return `${m.threshold.toLocaleString('en-US')} EHB`;
    default:
      return null;
  }
}

/** Biggest first; on 'totalxp' only the highest step crossed is worth a line. */
function milestoneLines(rows: MonthMilestoneRow[]): string[] {
  const topTotal = Math.max(0, ...rows.filter((r) => r.kind === 'totalxp').map((r) => r.threshold));
  const keep = rows.filter((r) => r.kind !== 'level' && (r.kind !== 'totalxp' || r.threshold === topTotal));
  const weight = (r: MonthMilestoneRow) => (r.kind === 'totalxp' ? 4 : r.kind === 'kc' ? 3 : r.kind === 'xp' ? 2 : 1);
  return keep
    .sort((a, b) => weight(b) - weight(a) || b.threshold - a.threshold)
    .map(milestoneLine)
    .filter((l): l is string => l != null);
}

/**
 * One character's month. `now` decides whether it is still running. Pets come from the log's pet
 * page and the plugin's pet lines alike, counted once by name.
 */
export function shapeMonthlyWrapped(input: {
  rsn: string;
  monthKey: string;
  now: Date;
  days: MonthDayRow[];
  milestones: MonthMilestoneRow[];
  clog: MonthClogRow[];
  pbs: MonthPbRow[];
  moments: MonthMomentRow[];
  rarity: ReadonlyMap<number, { denominator: number; source: string }>;
  petIds: ReadonlySet<number>;
}): MonthlyWrapped {
  let xpGained = 0;
  let ehpMilli = 0;
  let ehbMilli = 0;
  let daysActive = 0;
  const skills = new Map<string, number>();
  const bosses = new Map<string, number>();
  for (const d of input.days) {
    const deltas = parseDeltas(d.deltas);
    let moved = d.xpGained > 0;
    xpGained += Math.max(0, d.xpGained);
    ehpMilli += Math.max(0, d.ehpMilliGained);
    ehbMilli += Math.max(0, d.ehbMilliGained);
    for (const [k, v] of Object.entries(deltas.skills ?? {})) if (v > 0) skills.set(k, (skills.get(k) ?? 0) + v);
    for (const [k, v] of Object.entries(deltas.bosses ?? {})) {
      if (v <= 0) continue;
      bosses.set(k, (bosses.get(k) ?? 0) + v);
      moved = true;
    }
    if (moved) daysActive += 1;
  }
  const kcGained = [...bosses.values()].reduce((n, v) => n + v, 0);

  const itemOf = (id: number | null, name: string, valueGp: number | null = null): MonthItem => {
    const r = id != null ? input.rarity.get(id) : undefined;
    return { itemId: id, itemName: name, denominator: r?.denominator ?? null, source: r?.source ?? null, valueGp };
  };

  const slots = input.clog
    .map((c) => itemOf(c.itemId, c.itemName))
    .sort((a, b) => (b.denominator ?? 0) - (a.denominator ?? 0) || a.itemName.localeCompare(b.itemName));

  const pets = new Map<string, MonthItem>();
  for (const c of input.clog) if (input.petIds.has(c.itemId)) pets.set(c.itemName.toLowerCase(), itemOf(c.itemId, c.itemName));
  for (const m of input.moments) {
    if (m.kind !== 'pet' || !m.itemName) continue;
    const key = m.itemName.toLowerCase();
    if (!pets.has(key)) pets.set(key, itemOf(m.itemId, m.itemName));
  }

  let biggest: MonthMomentRow | null = null;
  for (const m of input.moments) {
    if ((m.kind !== 'unique' && m.kind !== 'loot') || !m.itemName) continue;
    if (!biggest || (m.valueGp ?? 0) > (biggest.valueGp ?? 0)) biggest = m;
  }

  return {
    rsn: input.rsn,
    monthKey: input.monthKey,
    monthLabel: monthLabel(input.monthKey),
    inProgress: monthKeyOf(input.now) === input.monthKey,
    xpGained,
    kcGained,
    ehpGained: ehpMilli / 1000,
    ehbGained: ehbMilli / 1000,
    daysActive,
    topSkills: [...skills].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([key, xp]) => ({ key, name: skillName(key), xp })),
    topBosses: [...bosses].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, kc]) => ({ key, name: bossName(key), kc })),
    maxed: input.milestones.filter((m) => m.kind === 'level' && m.threshold >= 99 && m.metric).map((m) => skillName(m.metric!)),
    milestones: milestoneLines(input.milestones),
    newSlots: input.clog.length,
    slots,
    pets: [...pets.values()],
    biggestDrop: biggest ? itemOf(biggest.itemId, biggest.itemName!, biggest.valueGp) : null,
    pbs: [...input.pbs]
      .sort((a, b) => a.activity.localeCompare(b.activity) || a.teamSize - b.teamSize)
      .map((p) => ({ activity: p.activity.replace(/\b\w/g, (c) => c.toUpperCase()), teamSize: p.teamSize, time: pbTime(p.centis) })),
  };
}

/** A month with nothing in it gets no card: an empty picture is a reason not to share. */
export function monthHasAnything(w: MonthlyWrapped): boolean {
  return w.xpGained > 0 || w.kcGained > 0 || w.newSlots > 0 || w.pbs.length > 0 || w.pets.length > 0 || w.biggestDrop != null;
}

/** The four numbers the card leads with. */
export function monthlyCardStats(w: MonthlyWrapped): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  if (w.xpGained > 0) out.push({ label: 'XP gained', value: shortNumber(w.xpGained) });
  if (w.kcGained > 0) out.push({ label: 'Boss kills', value: shortNumber(w.kcGained) });
  // No '+': the card's display face has no plus glyph and draws a broken one.
  if (w.newSlots > 0) out.push({ label: 'New slots', value: shortNumber(w.newSlots) });
  const hours = Math.round((w.ehpGained + w.ehbGained) * 60);
  if (hours > 0) out.push({ label: 'Efficient', value: cardHours(hours) });
  if (w.daysActive > 0) out.push({ label: 'Days active', value: shortNumber(w.daysActive) });
  if (w.pbs.length > 0) out.push({ label: 'PBs', value: shortNumber(w.pbs.length) });
  return out.slice(0, 4);
}

/** The line under the name: "21 days played". (A running month says "so far" in the eyebrow.) */
export function monthlyCardLine(w: MonthlyWrapped): string {
  return w.daysActive > 0 ? `${w.daysActive} day${w.daysActive === 1 ? '' : 's'} played` : '';
}

/** The pills: 99s first, then the month's biggest milestones. */
export function monthlyHighlights(w: MonthlyWrapped): string[] {
  return [...w.maxed.map((s) => `99 ${s}`), ...w.milestones].slice(0, 3);
}

/**
 * The picture: a pet; else the rarest log slot worth naming (1 in 100 or rarer); else the biggest
 * drop the plugin saw; else the boss they killed most.
 */
export function monthlyFeature(w: MonthlyWrapped): { image: string | null; kicker: string; name: string; detail: string | null } | null {
  const pet = w.pets[0];
  if (pet) {
    return {
      image: pet.itemId != null ? itemIconUrl(pet.itemId) : null,
      kicker: w.pets.length > 1 ? `${w.pets.length} pets` : 'Pet',
      name: pet.itemName,
      detail: null,
    };
  }
  const rare = w.slots[0];
  if (rare && rare.denominator != null && rare.denominator >= 100 && rare.itemId != null) {
    return { image: itemIconUrl(rare.itemId), kicker: 'Rarest new slot', name: rare.itemName, detail: `1 in ${shortNumber(rare.denominator)}` };
  }
  const drop = w.biggestDrop;
  if (drop) {
    return {
      image: drop.itemId != null ? itemIconUrl(drop.itemId) : null,
      kicker: 'Biggest drop',
      name: drop.itemName,
      detail: drop.valueGp && drop.valueGp > 0 ? `${shortNumber(drop.valueGp)} gp` : null,
    };
  }
  const boss = w.topBosses[0];
  if (boss) return { image: bossImageUrl(boss.name), kicker: 'Most killed', name: boss.name, detail: `${boss.kc.toLocaleString('en-US')} KC` };
  return null;
}

/** One line for the card: their grind in a sentence. */
export function monthlyStory(w: MonthlyWrapped): string | null {
  const skill = w.topSkills[0];
  const boss = w.topBosses[0];
  if (boss && skill) return `Most time on ${boss.name} and ${skill.name}`;
  if (boss) return `${boss.kc.toLocaleString('en-US')} ${boss.name} kills`;
  if (skill) return `${shortNumber(skill.xp)} ${skill.name} XP`;
  return null;
}
