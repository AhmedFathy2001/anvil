// The "next trip" target's storage and inputs (lib/tripTarget decides). OWNER-ONLY, like the items:
// the pick and the last clear live on the character's own item-snapshot rows (container 'target', no
// items), so they are read through the account's own person only and go when sharing is turned off.
// The other sources are read where they already are: the boss kc stamps (accounts.liveStatKeyTimes),
// the guides opened (guide_views), the saved setups (trip_setups).

import { and, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, guides, guideViews, playerItemSnapshots, tripSetups } from '@/db/schema';
import { firstGearBlock } from '@/lib/guideTiers';
import { kcKeyOf } from '@/lib/guideViewer';
import { parseStatKeyTimes } from '@/lib/liveStats';
import { ownsAccount } from '@/lib/playerItems';
import { contentFromKey } from '@/lib/tripContent';
import { equivalentsFor } from '@/lib/itemFamilies';
import { canonicalKey, guideTarget, isPickKey, resolveTarget, targetWhy, type Target, type TargetState } from '@/lib/tripTarget';
import { ttlMemo } from '@/lib/ttlMemo';

/** The container key the target is stored under (never one of CONTAINER_KINDS, nor 'state'). */
export const TARGET_ROW = 'target';

function readState(v: unknown): TargetState {
  const s = (v ?? {}) as { lock?: { key?: unknown; at?: unknown }; pick?: { key?: unknown; at?: unknown }; clearedAt?: unknown };
  const out: TargetState = {};
  if (s.lock && typeof s.lock.key === 'string' && typeof s.lock.at === 'string') out.lock = { key: s.lock.key.slice(0, 90), at: s.lock.at };
  if (s.pick && typeof s.pick.key === 'string' && typeof s.pick.at === 'string') out.pick = { key: s.pick.key.slice(0, 90), at: s.pick.at };
  if (typeof s.clearedAt === 'string') out.clearedAt = s.clearedAt;
  return out;
}

async function loadState(accountId: number): Promise<TargetState> {
  // clan-scope: global -- a character's own target, read for its own person (callers check).
  const [row] = await db
    .select({ state: playerItemSnapshots.state })
    .from(playerItemSnapshots)
    .where(and(eq(playerItemSnapshots.accountId, accountId), eq(playerItemSnapshots.container, TARGET_ROW)))
    .limit(1);
  return readState(row?.state);
}

async function saveState(accountId: number, state: TargetState): Promise<void> {
  const at = new Date().toISOString();
  const value = state as unknown as Record<string, unknown>;
  await db
    .insert(playerItemSnapshots)
    .values({ accountId, container: TARGET_ROW, items: [], state: value, readAt: at, updatedAt: at })
    .onConflictDoUpdate({ target: [playerItemSnapshots.accountId, playerItemSnapshots.container], set: { state: value, readAt: at, updatedAt: at } });
}

/** The content keys this character saved a setup for. */
export async function ownTripKeys(accountId: number): Promise<string[]> {
  // clan-scope: global -- the character's own setups.
  const rows = await db.select({ content: tripSetups.content }).from(tripSetups).where(eq(tripSetups.accountId, accountId));
  return [...new Set(rows.map((r) => r.content))];
}

/** A guide's kc boss and gear-block monster, kept five minutes (the body is long; guides change rarely). */
function guideFacts(guideId: number): Promise<{ slug: string; kcKey: string | null; monster: string | null } | null> {
  return ttlMemo(
    `trip-target:guide:${guideId}`,
    async () => {
      const [g] = await db.select({ slug: guides.slug, body: guides.body, status: guides.status }).from(guides).where(eq(guides.id, guideId)).limit(1);
      if (!g || g.status !== 'published') return null;
      const block = firstGearBlock(g.body);
      return { slug: g.slug, kcKey: kcKeyOf(block), monster: block?.monster || null };
    },
    5 * 60_000,
  );
}

/** The guide this person opened last (panel or site), mapped to a trip, or null. */
async function lastGuide(userId: number, ownKeys: readonly string[]): Promise<{ key: string | null; at: string } | null> {
  const [v] = await db.select({ id: guideViews.guideId, at: guideViews.viewedAt }).from(guideViews).where(eq(guideViews.userId, userId)).orderBy(desc(guideViews.viewedAt)).limit(1);
  if (!v) return null;
  const f = await guideFacts(v.id).catch(() => null);
  return { key: f ? guideTarget(f.slug, f.kcKey, f.monster, ownKeys) : null, at: v.at };
}

/** The trip a guide is for, for this character (its own setups count): "Going here next" shows for it. */
export async function guideTargetFor(accountId: number | null, guideId: number): Promise<string | null> {
  const [f, own] = await Promise.all([guideFacts(guideId).catch(() => null), accountId ? ownTripKeys(accountId) : Promise.resolve([])]);
  return f ? guideTarget(f.slug, f.kcKey, f.monster, own) : null;
}

/** What the character wears and packs now (the pushed snapshot), each id with what it counts as. */
async function carriedNow(accountId: number): Promise<{ ids: number[]; at: string } | null> {
  // clan-scope: global -- the character's own items, read for its own person (callers check).
  const rows = await db
    .select({ items: playerItemSnapshots.items, readAt: playerItemSnapshots.readAt })
    .from(playerItemSnapshots)
    .where(and(eq(playerItemSnapshots.accountId, accountId), inArray(playerItemSnapshots.container, ['equipment', 'inventory'])));
  if (!rows.length) return null;
  const raw = rows.flatMap((r) => (Array.isArray(r.items) ? (r.items as { id?: unknown }[]) : [])).map((it) => Number(it?.id)).filter((x) => Number.isInteger(x) && x > 0);
  const holds = equivalentsFor(raw, 'holds');
  const at = rows.map((r) => String(r.readAt)).sort().pop() ?? '';
  return { ids: [...new Set(raw.flatMap((id) => [id, ...holds(id)]))], at };
}

export interface TargetNow {
  target: Target | null;
  ownKeys: string[];
  state: TargetState;
}

/** The target now, for the account's own person only (anyone else gets none). */
export async function currentTarget(userId: number, accountId: number): Promise<TargetNow> {
  if (!(await ownsAccount(userId, accountId))) return { target: null, ownKeys: [], state: {} };
  const [state, ownKeys, acct] = await Promise.all([
    loadState(accountId),
    ownTripKeys(accountId),
    // clan-scope: global -- the character's own kc stamps.
    db.select({ times: accounts.liveStatKeyTimes }).from(accounts).where(eq(accounts.id, accountId)).limit(1),
  ]);
  const [guide, carried] = await Promise.all([lastGuide(userId, ownKeys), carriedNow(accountId)]);
  const target = resolveTarget({ state, guide, carried, kcTimes: parseStatKeyTimes(acct[0]?.times), ownKeys, now: Date.now() });
  return { target, ownKeys, state };
}

/** The target as the pre-trip check's way in says it ("Doom", "last trip"), or null when none is set. */
export async function targetLabel(userId: number, accountId: number): Promise<{ short: string; why: string } | null> {
  const t = (await currentTarget(userId, accountId)).target;
  return t ? { short: contentFromKey(t.key)?.short ?? t.key, why: targetWhy(t) } : null;
}

/** The player picked a target (a known trip or one of their saved setups); false when it can't be one. */
export async function pickTarget(userId: number, accountId: number, key: string, ownKeys: readonly string[]): Promise<boolean> {
  if (!isPickKey(key, ownKeys) || !(await ownsAccount(userId, accountId))) return false;
  key = canonicalKey(key);
  const prev = await loadState(accountId);
  // Changing the trip drops a lock (the new trip isn't locked until they lock it).
  const rest: TargetState = { ...prev };
  delete rest.lock;
  await saveState(accountId, { ...rest, pick: { key, at: new Date().toISOString() } });
  return true;
}

/**
 * The trip locked for this character: every bank close checks it, other bosses' banks don't switch
 * it, and it lasts until unlocked or changed. False when it can't be a target.
 */
export async function lockTarget(userId: number, accountId: number, key: string, ownKeys: readonly string[]): Promise<boolean> {
  if (!isPickKey(key, ownKeys) || !(await ownsAccount(userId, accountId))) return false;
  key = canonicalKey(key);
  const at = new Date().toISOString();
  const prev = await loadState(accountId);
  await saveState(accountId, { ...prev, lock: { key, at }, pick: { key, at } });
  return true;
}

/** "unlock" on the card: the trip stays the target as a pick, no longer locked. */
export async function unlockTarget(userId: number, accountId: number): Promise<void> {
  if (!(await ownsAccount(userId, accountId))) return;
  const prev = await loadState(accountId);
  if (!prev.lock) return;
  const { lock, ...rest } = prev;
  await saveState(accountId, { ...rest, pick: { key: lock.key, at: new Date().toISOString() } });
}

/**
 * "clear" in the panel, or the trip ended (death, logout, hop): every source older than now is gone.
 * A lock stays: only unlocking or changing the trip drops it.
 */
export async function clearTarget(accountId: number): Promise<void> {
  const prev = await loadState(accountId);
  await saveState(accountId, { ...(prev.lock ? { lock: prev.lock } : {}), clearedAt: new Date().toISOString() });
}
