// What the plugin saw a player holding, and their own guide preferences (skips, budget cap).
//
// OWNER-ONLY. A snapshot is read for exactly one audience: the person whose account it is, for their
// own views ("Missing", "Your version", "Fill from my plugin", auto "used it"). Every read goes
// through snapshotForViewer, which checks the account belongs to the viewer's person — clan staff,
// platform staff and everyone else get nothing. The plugin sends (POST /api/plugin/items); the site
// never pulls. Turning sharing off sends a DELETE and the rows go.

import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, guideItemSkips, guideViewerPrefs, playerItemSnapshots, users } from '@/db/schema';
import { CONTAINER_KINDS, type Container, type ContainerKind, type Snapshot } from '@/lib/gearOwnership';

const MAX_ITEMS: Record<ContainerKind, number> = { bank: 1500, inventory: 28, equipment: 14, lootingBag: 28 };
const MAX_ID = 100_000;
const MAX_Q = 2_147_483_647;

/** One container from a request, strictly: integer ids and counts, bounded, a parseable time. */
export function cleanContainer(kind: ContainerKind, v: unknown): Container | null {
  const c = v as { items?: unknown; readAt?: unknown } | null;
  if (!c || typeof c !== 'object' || !Array.isArray(c.items)) return null;
  if (c.items.length > MAX_ITEMS[kind]) return null;
  const items: Container['items'] = [];
  for (const raw of c.items) {
    const it = raw as { id?: unknown; q?: unknown };
    if (!it || typeof it.id !== 'number' || !Number.isInteger(it.id) || it.id <= 0 || it.id > MAX_ID) continue;
    const q = typeof it.q === 'number' && Number.isInteger(it.q) && it.q > 0 && it.q <= MAX_Q ? it.q : 1;
    items.push(q === 1 ? { id: it.id } : { id: it.id, q });
  }
  const t = typeof c.readAt === 'string' ? Date.parse(c.readAt) : NaN;
  const readAt = Number.isFinite(t) && t <= Date.now() + 60_000 ? new Date(t).toISOString() : new Date().toISOString();
  return { items, readAt };
}

/** Store the containers the plugin sent (only those present); the others keep their last reading. */
export async function saveSnapshot(accountId: number, snap: Snapshot): Promise<number> {
  const at = new Date().toISOString();
  let n = 0;
  for (const kind of CONTAINER_KINDS) {
    const c = snap[kind];
    if (!c) continue;
    await db
      .insert(playerItemSnapshots)
      .values({ accountId, container: kind, items: c.items, readAt: c.readAt, updatedAt: at })
      .onConflictDoUpdate({ target: [playerItemSnapshots.accountId, playerItemSnapshots.container], set: { items: c.items, readAt: c.readAt, updatedAt: at } });
    n++;
  }
  return n;
}

/** Sharing turned off: every character this login's person holds loses its stored items at once. */
export async function deleteSnapshotsForUser(userId: number): Promise<void> {
  const mine = db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(eq(users.id, userId));
  await db.delete(playerItemSnapshots).where(inArray(playerItemSnapshots.accountId, mine));
}

/** Does this account belong to this login's person? */
export async function ownsAccount(userId: number, accountId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(users.id, userId), eq(accounts.id, accountId)))
    .limit(1);
  return !!row;
}

/** The snapshot, for its owner only. Anyone else (staff included) gets null. */
export async function snapshotForViewer(userId: number, accountId: number): Promise<Snapshot | null> {
  if (!(await ownsAccount(userId, accountId))) return null;
  // clan-scope: global -- an account's own items, read for its own person.
  const rows = await db.select().from(playerItemSnapshots).where(eq(playerItemSnapshots.accountId, accountId));
  if (!rows.length) return null;
  const out: Snapshot = {};
  for (const r of rows) if ((CONTAINER_KINDS as string[]).includes(r.container)) out[r.container as ContainerKind] = { items: r.items, readAt: r.readAt };
  return out;
}

// ── Skips and the budget cap ─────────────────────────────────────────────────────────────────

export const SKIP_REASONS = [
  { key: 'cant_afford', label: "Can't afford" },
  { key: 'dont_want', label: "Don't want" },
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number]['key'];
export const isSkipReason = (v: unknown): v is SkipReason => SKIP_REASONS.some((r) => r.key === v);

export async function setSkip(accountId: number, itemId: number, reason: SkipReason): Promise<void> {
  if (!Number.isInteger(itemId) || itemId <= 0 || itemId > MAX_ID) return;
  await db
    .insert(guideItemSkips)
    .values({ accountId, itemId, reason, createdAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: [guideItemSkips.accountId, guideItemSkips.itemId], set: { reason } });
}

export async function clearSkip(accountId: number, itemId: number): Promise<void> {
  await db.delete(guideItemSkips).where(and(eq(guideItemSkips.accountId, accountId), eq(guideItemSkips.itemId, itemId)));
}

/** Null clears the cap. Capped at 2,147m (max cash stack) — beyond that a cap means nothing. */
export async function setBudgetCap(accountId: number, gp: number | null): Promise<void> {
  const cap = gp == null || !Number.isFinite(gp) || gp <= 0 ? null : Math.min(Math.floor(gp), 2_147_483_647);
  await db
    .insert(guideViewerPrefs)
    .values({ accountId, budgetCap: cap, updatedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: guideViewerPrefs.accountId, set: { budgetCap: cap, updatedAt: new Date().toISOString() } });
}

export interface AccountPrefs {
  /** item id → reason */
  skipped: Map<number, SkipReason>;
  budgetCap: number | null;
}

export async function prefsForAccount(accountId: number): Promise<AccountPrefs> {
  const [skips, [pref]] = await Promise.all([
    db.select({ itemId: guideItemSkips.itemId, reason: guideItemSkips.reason }).from(guideItemSkips).where(eq(guideItemSkips.accountId, accountId)),
    db.select({ cap: guideViewerPrefs.budgetCap }).from(guideViewerPrefs).where(eq(guideViewerPrefs.accountId, accountId)),
  ]);
  return {
    skipped: new Map(skips.map((s) => [s.itemId, (isSkipReason(s.reason) ? s.reason : 'dont_want') as SkipReason])),
    budgetCap: pref?.cap ?? null,
  };
}

/** "50m" / "1.2b" / "250k" / "50000000" → gp; null when it isn't a number. */
export function parseGp(v: string): number | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*([kmb])?\s*$/i.exec(v ?? '');
  if (!m) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] ?? '').toLowerCase() as 'k' | 'm' | 'b'] ?? 1;
  const n = Math.floor(Number(m[1]) * mult);
  return n > 0 ? n : null;
}
