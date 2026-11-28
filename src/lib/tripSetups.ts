// A player's own setups for the pre-trip check: "Save what you're wearing + inventory as a ToA setup".
// Several per character and trip, each with a name (set on the site, lib/tripSetupNames), a preset tag,
// and one of them the trip's default. The panel's Setup dropdown picks between them (the pick is
// remembered per trip, lib/tripRaidLevel); the site's My setups page renames, tags, shares and deletes.
//
// OWNER-ONLY: written and read only for the account's own person (the plugin token's, on a character
// that is theirs; or the signed-in person on the site), never shown to clan staff. A share link shows
// the setup itself (gear, inventory, pouch), never the bank or anything else of the player's. Deleted
// with the person (lib/personData); turning item sharing off leaves them, since they were saved on purpose.

import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, tripSetups, users } from '@/db/schema';
import { parseGearBlock, type GearSetup } from '@/lib/guideTiers';
import { ownsAccount } from '@/lib/playerItems';
import { cleanSetupName, cleanTag, newSetupName } from '@/lib/tripSetupNames';
import { saveTripSetupPick } from '@/lib/tripRaidLevel';

/** At most this many setups per character and trip, and per character in all. */
export const MAX_PER_TRIP = 12;
export const MAX_PER_CHARACTER = 80;

export interface SavedSetup {
  id: number;
  accountId: number;
  content: string;
  name: string;
  tag: string | null;
  isDefault: boolean;
  shareClan: boolean;
  shareToken: string | null;
  setup: GearSetup;
  createdAt: string;
  updatedAt: string;
}

/** A stored setup read back, through the gear block's own reader (tier and gear checked). */
function readSetup(v: unknown): GearSetup | null {
  return parseGearBlock(JSON.stringify({ monster: '', setups: [v] }))?.setups[0] ?? null;
}

const validKey = (content: string) => content.length > 0 && content.length <= 90;

type Row = typeof tripSetups.$inferSelect;
function toSaved(r: Row): SavedSetup | null {
  const setup = readSetup(r.setup);
  return setup ? { id: r.id, accountId: r.accountId, content: r.content, name: r.name, tag: r.tag, isDefault: r.isDefault, shareClan: r.shareClan, shareToken: r.shareToken, setup, createdAt: r.createdAt, updatedAt: r.updatedAt } : null;
}

/** A character's setups (one trip's, or all), default first then oldest first. Owner only. */
export async function listOwnSetups(userId: number, accountId: number, content?: string): Promise<SavedSetup[]> {
  if ((content != null && !validKey(content)) || !(await ownsAccount(userId, accountId))) return [];
  // clan-scope: global -- a character's own setups, read for its own person.
  const rows = await db
    .select()
    .from(tripSetups)
    .where(content != null ? and(eq(tripSetups.accountId, accountId), eq(tripSetups.content, content)) : eq(tripSetups.accountId, accountId))
    .orderBy(desc(tripSetups.isDefault), asc(tripSetups.id));
  return rows.map(toSaved).filter((s): s is SavedSetup => !!s);
}

/**
 * The setup the check uses for a trip: `id` when it is one of this trip's (the panel's pick), else
 * the trip's default. Owner only.
 */
export async function ownTripSetupRow(userId: number, accountId: number, content: string, id?: number | null): Promise<SavedSetup | null> {
  const all = await listOwnSetups(userId, accountId, content);
  return (id != null ? all.find((s) => s.id === id) : null) ?? all.find((s) => s.isDefault) ?? all[0] ?? null;
}

export async function ownTripSetup(userId: number, accountId: number, content: string, id?: number | null): Promise<GearSetup | null> {
  return (await ownTripSetupRow(userId, accountId, content, id))?.setup ?? null;
}

/**
 * A new setup for the trip, named after the first preset tag not used yet ("CoX Trio"), else "Setup N".
 * The trip's first setup is its default. Null when it isn't theirs or the trip is full.
 */
export async function createTripSetup(userId: number, accountId: number, content: string, short: string, setup: GearSetup): Promise<{ id: number; name: string } | null> {
  if (!validKey(content) || !(await ownsAccount(userId, accountId))) return null;
  // clan-scope: global -- the character's own setups.
  const mine = await db.select({ content: tripSetups.content, name: tripSetups.name, tag: tripSetups.tag }).from(tripSetups).where(eq(tripSetups.accountId, accountId));
  const here = mine.filter((r) => r.content === content);
  if (here.length >= MAX_PER_TRIP || mine.length >= MAX_PER_CHARACTER) return null;
  const { name, tag } = newSetupName(content, short, here);
  const at = new Date().toISOString();
  const [row] = await db
    .insert(tripSetups)
    .values({ accountId, content, setup: { ...setup, name } as unknown as Record<string, unknown>, name, tag, isDefault: here.length === 0, createdAt: at, updatedAt: at })
    .returning({ id: tripSetups.id });
  return row ? { id: row.id, name } : null;
}

/**
 * The gear of a saved setup replaced (its name, tag and sharing kept): setup `id`, else the trip's
 * default, else a new one (the trip's first). The setup id, or null when it isn't theirs.
 */
export async function saveOwnTripSetup(userId: number, accountId: number, content: string, setup: GearSetup, id?: number | null, short?: string): Promise<number | null> {
  if (!validKey(content) || !(await ownsAccount(userId, accountId))) return null;
  const into = await ownTripSetupRow(userId, accountId, content, id);
  if (!into || (id != null && into.id !== id)) {
    if (id != null) return null;
    return (await createTripSetup(userId, accountId, content, short ?? 'My', setup))?.id ?? null;
  }
  const at = new Date().toISOString();
  await db
    .update(tripSetups)
    .set({ setup: { ...setup, name: into.name } as unknown as Record<string, unknown>, updatedAt: at })
    .where(and(eq(tripSetups.id, into.id), eq(tripSetups.accountId, accountId)));
  return into.id;
}

/** After the default went: the trip's oldest setup left takes over. */
async function promoteDefault(accountId: number, content: string): Promise<void> {
  // clan-scope: global -- the character's own setups.
  const rows = await db.select({ id: tripSetups.id, isDefault: tripSetups.isDefault }).from(tripSetups).where(and(eq(tripSetups.accountId, accountId), eq(tripSetups.content, content))).orderBy(asc(tripSetups.id));
  if (rows.length && !rows.some((r) => r.isDefault)) await db.update(tripSetups).set({ isDefault: true }).where(eq(tripSetups.id, rows[0].id));
}

/** Forgets setup `id` of the trip (else the trip's default); the next one becomes the default. */
export async function forgetOwnTripSetup(userId: number, accountId: number, content: string, id?: number | null): Promise<void> {
  const row = await ownTripSetupRow(userId, accountId, content, id);
  if (!row || (id != null && row.id !== id)) return;
  await db.delete(tripSetups).where(and(eq(tripSetups.id, row.id), eq(tripSetups.accountId, accountId)));
  await promoteDefault(accountId, content);
}

// ── By id, for the site's My setups page: the signed-in person's own setups only ───────────────

/** Setup `id` when it is on a character of this person's (the only way in for the page's actions). */
export async function setupOfUser(userId: number, id: number): Promise<SavedSetup | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  // clan-scope: global -- a person's own setup.
  const [row] = await db
    .select({ s: tripSetups })
    .from(tripSetups)
    .innerJoin(accounts, eq(accounts.id, tripSetups.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(and(eq(tripSetups.id, id), eq(users.id, userId)))
    .limit(1);
  return row ? toSaved(row.s) : null;
}

/** Every setup on this person's characters (the My setups page). */
export async function setupsOfUser(userId: number): Promise<SavedSetup[]> {
  // clan-scope: global -- a person's own setups.
  const rows = await db
    .select({ s: tripSetups })
    .from(tripSetups)
    .innerJoin(accounts, eq(accounts.id, tripSetups.accountId))
    .innerJoin(users, eq(users.playerId, accounts.playerId))
    .where(eq(users.id, userId))
    .orderBy(asc(tripSetups.content), desc(tripSetups.isDefault), asc(tripSetups.id));
  return rows.map((r) => toSaved(r.s)).filter((s): s is SavedSetup => !!s);
}

export interface SetupPatch {
  name?: unknown;
  tag?: unknown;
  isDefault?: unknown;
  shareClan?: unknown;
}

/** Renames, tags, makes default or shares one of the person's setups; an error line, or null when done. */
export async function updateSetupOfUser(userId: number, id: number, patch: SetupPatch): Promise<string | null> {
  const row = await setupOfUser(userId, id);
  if (!row) return 'Not one of your setups.';
  const set: Partial<Row> = {};
  if (patch.name !== undefined) {
    const name = cleanSetupName(patch.name);
    if (!name) return 'A name is 1 to 24 characters.';
    set.name = name;
    set.setup = { ...row.setup, name } as unknown as Record<string, unknown>;
  }
  if (patch.tag !== undefined) {
    const tag = cleanTag(row.content, patch.tag);
    if (tag === undefined) return 'That tag isn’t one of this trip’s.';
    set.tag = tag;
  }
  if (patch.shareClan !== undefined) {
    if (typeof patch.shareClan !== 'boolean') return 'Share with clan is on or off.';
    set.shareClan = patch.shareClan;
  }
  if (patch.isDefault === true && !row.isDefault) {
    await db.transaction(async (tx) => {
      await tx.update(tripSetups).set({ isDefault: false }).where(and(eq(tripSetups.accountId, row.accountId), eq(tripSetups.content, row.content), eq(tripSetups.isDefault, true)));
      await tx.update(tripSetups).set({ isDefault: true }).where(eq(tripSetups.id, row.id));
    });
    // The panel follows the new default (its own pick for the trip is dropped).
    await saveTripSetupPick(row.accountId, row.content, null);
  }
  if (Object.keys(set).length) await db.update(tripSetups).set({ ...set, updatedAt: new Date().toISOString() }).where(eq(tripSetups.id, row.id));
  return null;
}

/** The setup's share link token, made on first ask. Null when it isn't theirs. */
export async function shareTokenOfUser(userId: number, id: number): Promise<string | null> {
  const row = await setupOfUser(userId, id);
  if (!row) return null;
  if (row.shareToken) return row.shareToken;
  const token = randomBytes(12).toString('base64url');
  await db.update(tripSetups).set({ shareToken: token }).where(eq(tripSetups.id, row.id));
  return token;
}

/** Stops the share link (a new one is made on the next ask). */
export async function stopShareOfUser(userId: number, id: number): Promise<boolean> {
  const row = await setupOfUser(userId, id);
  if (!row) return false;
  await db.update(tripSetups).set({ shareToken: null }).where(eq(tripSetups.id, row.id));
  return true;
}

export async function deleteSetupOfUser(userId: number, id: number): Promise<boolean> {
  const row = await setupOfUser(userId, id);
  if (!row) return false;
  await db.delete(tripSetups).where(eq(tripSetups.id, row.id));
  if (row.isDefault) await promoteDefault(row.accountId, row.content);
  return true;
}

/** A setup by its share link: the setup only (name, trip, gear and inventory), never whose bank. */
export async function sharedSetup(token: string): Promise<{ name: string; content: string; setup: GearSetup } | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) return null;
  // clan-scope: global -- a share link is public by the owner's choice.
  const [row] = await db.select().from(tripSetups).where(eq(tripSetups.shareToken, token)).limit(1);
  const s = row ? toSaved(row) : null;
  return s ? { name: s.name, content: s.content, setup: s.setup } : null;
}

// ── Shared with the clan: the panel's "From your clan" options ─────────────────────────────────

/** A clanmate's setup shared with the clan: the setup only (name, gear, inventory, pouch), and who shared it. */
export interface ClanSetup {
  id: number;
  name: string;
  /** The sharer's RSN: on the clan's own in-game roster (a live member seat), so already public in the clan. */
  rsn: string;
  setup: GearSetup;
}

/**
 * The clan this character holds a live member seat in (OSRS lets an account be in one clan), from
 * the seat itself: never from anything the caller sends. Null when it has none.
 */
export async function memberClanOf(accountId: number): Promise<number | null> {
  // clan-scope: global -- the character's own seat decides the clan.
  const [row] = await db
    .select({ clanId: clanMemberships.clanId })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.accountId, accountId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
    .limit(1);
  return row?.clanId ?? null;
}

const MAX_CLAN_SETUPS = 20;

/**
 * Setups clanmates shared with the clan for these trips, for the person playing `accountId` (which
 * the caller has proven is theirs). Only sharers with a live member seat in the same clan, never the
 * person's own characters; only the setup itself, never a bank or stats. `id` narrows it to one.
 */
export async function clanSharedSetups(userId: number, accountId: number, contents: readonly string[], id?: number): Promise<ClanSetup[]> {
  const keys = contents.filter(validKey);
  if (!keys.length || !(await ownsAccount(userId, accountId))) return [];
  const clanId = await memberClanOf(accountId);
  if (clanId == null) return [];
  // clan-scope: global -- the viewer's own person, to leave their own characters out.
  const [me] = await db.select({ playerId: accounts.playerId }).from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!me) return [];
  // clan-scope: clan -- pinned to the viewer's own member clan by the sharer's live member seat.
  const rows = await db
    .select({ s: tripSetups, rsn: accounts.rsn })
    .from(tripSetups)
    .innerJoin(accounts, eq(accounts.id, tripSetups.accountId))
    .innerJoin(clanMemberships, and(eq(clanMemberships.accountId, accounts.id), eq(clanMemberships.clanId, clanId), eq(clanMemberships.kind, 'member'), isNull(clanMemberships.leftAt)))
    .where(and(eq(tripSetups.shareClan, true), inArray(tripSetups.content, keys), ne(accounts.playerId, me.playerId), id != null ? eq(tripSetups.id, id) : undefined))
    .orderBy(asc(tripSetups.name), asc(tripSetups.id))
    .limit(MAX_CLAN_SETUPS);
  return rows
    .map((r) => {
      const saved = toSaved(r.s);
      return saved ? { id: saved.id, name: saved.name || saved.setup.name, rsn: r.rsn, setup: saved.setup } : null;
    })
    .filter((x): x is ClanSetup => !!x);
}
