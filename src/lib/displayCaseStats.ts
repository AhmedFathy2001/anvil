// The display case's stat pins, the pure half: kill counts and personal bests (lib/displayCase is the
// database half). No database, so tests/display-case-stats.test.ts runs without one.
//
// A 'kc' pin's stat key is a hiscores boss key ("tzKalZuk"). A 'pb' pin's stat key is
// "<teamSize>:<activity>" — the two columns of member_personal_bests' key in one string, team size
// first because it is a number and the activity may hold any character.

import { BOSSES } from '@/lib/constants';
import { formatPersonalBest, titleCaseActivity } from '@/lib/clogProfile';
import { parsePbActivity } from '@/lib/pbGroups';
import { parsePluginStats } from '@/lib/pluginStats';

export { formatPersonalBest };

export type PinKind = 'clog' | 'drop' | 'kc' | 'pb';

export type PinInput =
  | { kind: 'clog'; accountId: number; itemId: number }
  | { kind: 'drop'; momentId: number }
  | { kind: 'kc'; accountId: number; statKey: string }
  | { kind: 'pb'; accountId: number; statKey: string };

/** Lowercased and trimmed the way lib/personalBests stores it; the same caps. */
const MAX_ACTIVITY = 80;
const MAX_TEAM = 100;
const BOSS_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,63}$/;

export function pbStatKey(activity: string, teamSize: number): string {
  return `${teamSize}:${activity}`;
}

/** Null when it is not one we could have written. */
export function parsePbStatKey(key: string): { activity: string; teamSize: number } | null {
  const m = /^(\d{1,3}):(.+)$/.exec(key);
  if (!m) return null;
  const teamSize = Number(m[1]);
  const activity = m[2];
  if (teamSize > MAX_TEAM || activity.length > MAX_ACTIVITY || activity !== activity.trim().toLowerCase()) return null;
  return { activity, teamSize };
}

/** Parse a pin request body. Null when it is not one. */
export function parsePinInput(body: unknown): PinInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 && v < 2 ** 31 ? v : null);
  if (b.kind === 'clog') {
    const accountId = int(b.accountId);
    const itemId = int(b.itemId);
    return accountId && itemId ? { kind: 'clog', accountId, itemId } : null;
  }
  if (b.kind === 'drop') {
    const momentId = int(b.momentId);
    return momentId ? { kind: 'drop', momentId } : null;
  }
  if (b.kind === 'kc' || b.kind === 'pb') {
    const accountId = int(b.accountId);
    const statKey = typeof b.statKey === 'string' ? b.statKey : '';
    if (!accountId || !statKey) return null;
    if (b.kind === 'kc') return BOSS_KEY.test(statKey) ? { kind: 'kc', accountId, statKey } : null;
    return parsePbStatKey(statKey) ? { kind: 'pb', accountId, statKey } : null;
  }
  return null;
}

const BOSS_LABELS = new Map(BOSSES.map((b) => [b.key, b.label]));
/** The boss's own spelling for a base the game lowercased ("tzkal-zuk" → "TzKal-Zuk"). */
const BOSS_SPELLING = new Map(BOSSES.map((b) => [b.label.toLowerCase(), b.label]));

/** "tzKalZuk" → "TzKal-Zuk"; a key we have no label for is spelled out from its camel case. */
export function kcLabel(key: string): string {
  return BOSS_LABELS.get(key) ?? key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
}

/** "12 KC". */
export function kcHeadline(kc: number): string {
  return `${kc.toLocaleString('en-GB')} KC`;
}

/**
 * "Chambers of Xeric (Solo)", "Vardorvis (Awakened)", "Tombs of Amascut: Expert Mode (4 players)" — the
 * way the profile's personal-best list names a boss and its mode (lib/pbGroups), plus the team size.
 */
export function pbLabel(activity: string, teamSize: number): string {
  const parsed = parsePbActivity(titleCaseActivity(activity));
  const { mode, team } = parsed;
  const base = BOSS_SPELLING.get(parsed.base.toLowerCase()) ?? parsed.base;
  const name = !mode ? base : /mode$/i.test(mode) ? `${base}: ${mode}` : `${base} (${mode})`;
  const size = teamSize > 0 ? (teamSize === 1 ? 'Solo' : `${teamSize} players`) : team ? (/^solo$/i.test(team) ? 'Solo' : `${team} players`) : '';
  return size ? `${name} (${size})` : name;
}

/**
 * A character's boss kill counts as the site knows them now: the last hiscores sweep, raised by what
 * the plugin has pushed since (the same max(hiscores, live) every stat tile uses). Only counts above
 * zero; unranked (-1) is none.
 */
export function bossKillcounts(snapshotJson: string | null | undefined, liveJson: string | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  try {
    const snap = snapshotJson ? JSON.parse(snapshotJson) : null;
    for (const [key, entry] of Object.entries((snap?.bosses ?? {}) as Record<string, { score?: unknown }>)) {
      const kc = entry?.score;
      if (typeof kc === 'number' && Number.isInteger(kc) && kc > 0) out.set(key, kc);
    }
  } catch {
    // A corrupt blob is no hiscores, not a broken case; the live push below still counts.
  }
  for (const [key, v] of Object.entries(parsePluginStats(liveJson))) {
    // The live map is boss keys only, but it is plugin-written: anything we cannot name is skipped.
    if (!BOSS_LABELS.has(key) && !out.has(key)) continue;
    const kc = Math.floor(v);
    if (kc > (out.get(key) ?? 0)) out.set(key, kc);
  }
  return out;
}
