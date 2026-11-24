// Who is reading a guide, as far as the site already knows: their main character's levels and boss
// kc (hiscores snapshot), account type (the plugin's IRONMAN varbit), quests / diaries / combat tasks
// (plugin progress pushes), collection log, and — owner-only — what the plugin saw them holding.
// Logged out, or nothing known: an empty viewer, and every page still works.

import { and, asc, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, accountStatSnapshots, memberClogItems, memberProgress, memberProgressItems, users } from '@/db/schema';
import { BOSSES } from '@/lib/constants';
import { DIARY_EASY, DIARY_ELITE, DIARY_HARD, DIARY_MEDIUM, DIARY_REGIONS } from '@/lib/memberProgress';
import { parseItems } from '@/lib/memberProgressItems';
import { equivalentsFrom, ownedCounts, type Equivalents, type Snapshot } from '@/lib/gearOwnership';
import { guideAccountOf, guideBuildOf, type GuideAccount, type GuideBuild } from '@/lib/guideSetups';
import type { RouteFacts } from '@/lib/guideRoutes';
import type { GearBlock } from '@/lib/guideTiers';
import { prefsForAccount, snapshotForViewer, type AccountPrefs } from '@/lib/playerItems';
import { withItemVariants } from '@/lib/itemVariants';

export interface GuideViewer {
  userId: number | null;
  playerId: number | null;
  accountId: number | null;
  rsn: string | null;
  account: GuideAccount | null;
  build: GuideBuild | null;
  levels: Record<string, number> | null;
  kc: Record<string, number>;
  quests: Set<string> | null;
  diaries: Set<string> | null;
  cas: Set<string> | null;
  clog: Set<number> | null;
  /** Owner-only: what the plugin saw (phase 2). */
  snapshot: Snapshot | null;
  prefs: AccountPrefs | null;
}

export const EMPTY_VIEWER: GuideViewer = {
  userId: null, playerId: null, accountId: null, rsn: null, account: null, build: null, levels: null, kc: {},
  quests: null, diaries: null, cas: null, clog: null, snapshot: null, prefs: null,
};

const DIARY_BITS: [number, string][] = [
  [DIARY_EASY, 'easy'],
  [DIARY_MEDIUM, 'medium'],
  [DIARY_HARD, 'hard'],
  [DIARY_ELITE, 'elite'],
];

/** "diaryArdougne" → "ardougne"; "diaryKourend" → "kourend". */
const regionOf = (key: string) => key.replace(/^diary/, '').toLowerCase();

/** The signed-in person's main character, with what we know of it. */
export async function guideViewer(user: { userId: number; playerId: number } | null, opts: { items?: boolean; /** The character being played (plugin), when it is this person's. */ accountId?: number | null } = {}): Promise<GuideViewer> {
  if (!user?.playerId) return EMPTY_VIEWER;
  // clan-scope: global -- a person's own characters.
  const [main] = await db
    .select({ id: accounts.id, rsn: accounts.rsn, accountType: accounts.accountType, snapshot: accountStatSnapshots.snapshot })
    .from(accounts)
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(and(eq(accounts.playerId, user.playerId), opts.accountId ? eq(accounts.id, opts.accountId) : undefined))
    .orderBy(desc(accounts.isPrimary), asc(accounts.id))
    .limit(1);
  if (!main) return { ...EMPTY_VIEWER, userId: user.userId, playerId: user.playerId };
  let levels: Record<string, number> | null = null;
  const kc: Record<string, number> = {};
  try {
    const j = main.snapshot ? (JSON.parse(main.snapshot) as { skills?: Record<string, { level?: number }>; bosses?: Record<string, { score?: number }> }) : null;
    if (j?.skills && Object.keys(j.skills).length) {
      levels = {};
      for (const [k, v] of Object.entries(j.skills)) if (typeof v?.level === 'number') levels[k] = v.level;
    }
    for (const [k, v] of Object.entries(j?.bosses ?? {})) if (typeof v?.score === 'number' && v.score > 0) kc[k] = v.score;
  } catch {
    /* unreadable snapshot: nothing known */
  }
  const [progress, items, clog] = await Promise.all([
    db.select({ key: memberProgress.key, value: memberProgress.value }).from(memberProgress).where(eq(memberProgress.accountId, main.id)),
    db.select({ category: memberProgressItems.category, payload: memberProgressItems.payload }).from(memberProgressItems).where(eq(memberProgressItems.accountId, main.id)),
    db.select({ itemId: memberClogItems.itemId }).from(memberClogItems).where(eq(memberClogItems.accountId, main.id)),
  ]);
  const regions = new Set(DIARY_REGIONS.map((r) => r.key));
  const diaryRows = progress.filter((p) => regions.has(p.key));
  const diaries = diaryRows.length ? new Set<string>() : null;
  for (const p of diaryRows) for (const [bit, tier] of DIARY_BITS) if ((Number(p.value) & bit) === bit) diaries!.add(`${regionOf(p.key)}:${tier}`);
  const done = (cat: 'quest' | 'ca') => {
    const row = items.find((i) => i.category === cat);
    return row ? new Set(parseItems(row.payload).filter((x) => x.state === 2).map((x) => x.name.toLowerCase())) : null;
  };
  const [snapshot, prefs] = opts.items ? await Promise.all([snapshotForViewer(user.userId, main.id), prefsForAccount(main.id)]) : [null, null];
  return {
    userId: user.userId,
    playerId: user.playerId,
    accountId: main.id,
    rsn: main.rsn,
    account: main.accountType ? guideAccountOf(main.accountType) : null,
    build: levels ? guideBuildOf(levels) : null,
    levels,
    kc,
    quests: done('quest'),
    diaries,
    cas: done('ca'),
    clog: clog.length ? new Set(clog.map((c) => c.itemId)) : null,
    snapshot,
    prefs,
  };
}

/** The viewer as route facts (lib/guideRoutes), with their manual ticks. */
export function routeFacts(v: GuideViewer, manual: string[] = [], eq?: Equivalents): RouteFacts {
  let items: Set<number> | null = null;
  if (v.snapshot) {
    items = new Set();
    for (const id of ownedCounts(v.snapshot).keys()) for (const x of eq ? eq(id) : [id]) items.add(x);
  }
  return { levels: v.levels, quests: v.quests, diaries: v.diaries, cas: v.cas, clog: v.clog, items, kc: v.kc, manual: new Set(manual) };
}

/** Item equivalences for a set of ids: itemVariants groups (server-only data) + the cosmetic list. */
export function equivalentsFor(ids: number[]): Equivalents {
  const groups = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0).map((id) => withItemVariants([id]));
  return equivalentsFrom(groups);
}

/** Every item id a gear block mentions (gear, fallbacks, quiver, inventory, pouch). */
export function blockItemIds(block: GearBlock | null): number[] {
  if (!block) return [];
  const out = new Set<number>();
  for (const s of block.setups) {
    for (const id of Object.values(s.gear)) out.add(id);
    for (const list of Object.values(s.alts ?? {})) for (const id of list ?? []) out.add(id);
    if (s.quiver) out.add(s.quiver);
    for (const it of s.inventory ?? []) if (it) out.add(it.id);
    for (const it of s.runePouch ?? []) out.add(it.id);
  }
  return [...out].filter((id) => Number.isInteger(id) && id > 0);
}

/** The hiscores boss key a gear block is about: its own kcKey, else the boss whose name it names. */
export function kcKeyOf(block: GearBlock | null): string | null {
  if (!block) return null;
  if (block.kcKey && BOSSES.some((b) => b.key === block.kcKey)) return block.kcKey;
  const name = block.monster.split('#')[0].trim().toLowerCase();
  return BOSSES.find((b) => b.label.toLowerCase() === name || (b.aliases ?? []).some((a) => a.toLowerCase() === name))?.key ?? null;
}

/** Display names for users, by id. */
export async function userNames(ids: number[]): Promise<Map<number, string>> {
  const uniq = [...new Set(ids.filter((x) => Number.isInteger(x)))];
  if (!uniq.length) return new Map();
  // Players' own RSNs where they have one (never the Discord name on public surfaces).
  const rows = await db
    .select({ id: users.id, rsn: accounts.rsn, primary: accounts.isPrimary })
    .from(users)
    .leftJoin(accounts, and(eq(accounts.playerId, users.playerId)))
    .where(inArray(users.id, uniq));
  const out = new Map<number, string>();
  for (const r of rows.sort((a, b) => (b.primary ?? 0) - (a.primary ?? 0))) if (!out.has(r.id)) out.set(r.id, r.rsn ?? 'A player');
  return out;
}
