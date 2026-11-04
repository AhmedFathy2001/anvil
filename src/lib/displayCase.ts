// The display case: a row of a person's best drops on their profile (Anvil Supporter — 4 slots,
// Champion 8, Patron 12). The slot count is lib/profileMediaRules; this is the database half.
//
// PINS COME FROM THEIR OWN VERIFIED RECORD, never from a typed-in item: an obtained collection-log
// slot the plugin reported (member_clog_items) or a drop moment (moments), on a character that is
// theirs and proven theirs. Both are re-checked on every read, so a character that leaves them, an
// item that drops out of the log, or a deleted moment stops showing with no write.
//
// PRIVACY. A pin names the character it came from. On a public page that is only allowed for a
// character its owner SHARES — the same rule as /u/ and /p/ — so a pin from a private character is
// shown to its owner alone, and never tells a stranger that the private character exists.

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships, displayCaseItems, memberClogItems, moments, users } from '@/db/schema';
import { clogItemNames, clogPageOfItem } from '@/lib/clogDataset';
import { getItemPrices } from '@/lib/itemPrices';
import { itemIconUrl } from '@/lib/tileIcons';
import { supporterForUser } from '@/lib/supporter';
import { DISPLAY_CASE_MAX, displayCaseSlots, visiblePins } from '@/lib/profileMediaRules';
import type { SupporterTierId } from '@/lib/supporterTiers';

/** The moment kinds that are an item worth showing off. */
const DROP_KINDS = ['pet', 'unique', 'loot', 'clog'] as const;

export interface DisplayCaseEntry {
  id: number;
  position: number;
  kind: 'clog' | 'drop';
  accountId: number;
  rsn: string;
  /** The character is published (accounts.shared); only these show to anybody but the owner. */
  shared: boolean;
  itemId: number;
  name: string;
  icon: string;
  /** When it happened, if known: the drop's time, or when the log first showed it. Null = before tracking. */
  when: string | null;
  kc: number | null;
  /** GE value (the drop's own price, else today's mid). Null for untradeables. */
  valueGp: number | null;
  /** Where it came from: the log page or the drop's source. */
  source: string | null;
  /** The record that backs it: the character's collection-log page, when that page is public. */
  proofHref: string | null;
}

export interface DisplayCaseCandidate {
  key: string;
  kind: 'clog' | 'drop';
  accountId: number;
  rsn: string;
  itemId: number;
  momentId: number | null;
  name: string;
  icon: string;
  when: string | null;
  valueGp: number | null;
  source: string | null;
}

/** The person's characters that may supply pins: theirs, and proven theirs. */
async function verifiedAccounts(playerId: number) {
  return db
    .select({ id: accounts.id, rsn: accounts.rsn, shared: accounts.shared })
    .from(accounts)
    .where(and(eq(accounts.playerId, playerId), isNotNull(accounts.verifiedAt), eq(accounts.provisional, 0)));
}

function clogHref(rsn: string, itemId: number): string | null {
  const page = clogPageOfItem().get(itemId);
  return page ? `/p/${encodeURIComponent(rsn)}?tab=collection&page=${encodeURIComponent(page)}` : null;
}

/**
 * Every pin of this login that still stands, in order, resolved for display — the owner's view.
 * Not sliced to the tier or filtered for strangers: `displayCaseFor` does both.
 */
export async function readDisplayCase(userId: number, playerId: number | null): Promise<DisplayCaseEntry[]> {
  if (playerId == null) return [];
  const pins = await db
    .select()
    .from(displayCaseItems)
    .where(eq(displayCaseItems.userId, userId))
    .orderBy(asc(displayCaseItems.position), asc(displayCaseItems.id));
  if (pins.length === 0) return [];

  const owned = new Map((await verifiedAccounts(playerId)).map((a) => [a.id, a]));
  const live = pins.filter((p) => owned.has(p.accountId));
  if (live.length === 0) return [];

  const clogPins = live.filter((p) => p.kind === 'clog');
  const dropPins = live.filter((p) => p.kind === 'drop' && p.momentId != null);

  const clogRows = clogPins.length
    ? await db
        .select({
          accountId: memberClogItems.accountId,
          itemId: memberClogItems.itemId,
          pageName: memberClogItems.pageName,
          firstSeenAt: memberClogItems.firstSeenAt,
          kc: memberClogItems.kcAtUnlock,
        })
        .from(memberClogItems)
        .where(
          and(
            inArray(memberClogItems.accountId, [...new Set(clogPins.map((p) => p.accountId))]),
            inArray(memberClogItems.itemId, [...new Set(clogPins.map((p) => p.itemId))]),
          ),
        )
    : [];
  const clogByKey = new Map(clogRows.map((r) => [`${r.accountId}:${r.itemId}`, r]));

  // clan-scope: global -- the subject is this person's OWN drops on their own characters, across every
  // clan they were in; the seat is joined only to prove the drop's character is the pinned one.
  const dropRows = dropPins.length
    ? await db
        .select({
          id: moments.id,
          accountId: clanMemberships.accountId,
          itemId: moments.itemId,
          itemName: moments.itemName,
          valueGp: moments.valueGp,
          source: moments.source,
          kc: moments.kc,
          occurredAt: moments.occurredAt,
        })
        .from(moments)
        .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
        .where(inArray(moments.id, dropPins.map((p) => p.momentId!)))
    : [];
  const dropById = new Map(dropRows.map((r) => [r.id, r]));

  const names = clogItemNames();
  const prices = await getItemPrices().catch(() => new Map<number, number>());
  const out: DisplayCaseEntry[] = [];
  for (const p of live) {
    const acct = owned.get(p.accountId)!;
    const base = { id: p.id, position: p.position, accountId: p.accountId, rsn: acct.rsn, shared: !!acct.shared, itemId: p.itemId };
    const proofHref = acct.shared ? clogHref(acct.rsn, p.itemId) : null;
    if (p.kind === 'clog') {
      const row = clogByKey.get(`${p.accountId}:${p.itemId}`);
      if (!row) continue;
      out.push({
        ...base,
        kind: 'clog',
        name: names.get(p.itemId) ?? `Item ${p.itemId}`,
        icon: itemIconUrl(p.itemId),
        when: row.firstSeenAt,
        kc: row.kc,
        valueGp: prices.get(p.itemId) ?? null,
        source: row.pageName,
        proofHref,
      });
    } else {
      const row = p.momentId != null ? dropById.get(p.momentId) : undefined;
      if (!row || row.accountId !== p.accountId || row.itemId !== p.itemId) continue;
      out.push({
        ...base,
        kind: 'drop',
        name: (row.itemName ?? names.get(p.itemId) ?? `Item ${p.itemId}`).slice(0, 80),
        icon: itemIconUrl(p.itemId),
        when: row.occurredAt,
        kc: row.kc,
        valueGp: row.valueGp ?? prices.get(p.itemId) ?? null,
        source: row.source ? row.source.slice(0, 80) : null,
        proofHref,
      });
    }
  }
  return out;
}

/**
 * What a page shows: the stored pins that still stand, cut to the tier's slots. `publicView` drops
 * pins from characters that are not shared; `accountId` keeps one character's (its own /p/ page).
 */
export async function displayCaseFor(
  userId: number,
  playerId: number | null,
  tier: SupporterTierId | null | undefined,
  opts: { publicView?: boolean; accountId?: number } = {},
): Promise<DisplayCaseEntry[]> {
  if (displayCaseSlots(tier) === 0) return [];
  try {
    // The cut is over the whole case (the first N the tier allows), THEN narrowed — a lapsed
    // Champion's ninth pin must not resurface on a character page because the first eight were
    // from other characters.
    return visiblePins(await readDisplayCase(userId, playerId), tier).filter(
      (e) => (opts.accountId == null || e.accountId === opts.accountId) && (!opts.publicView || e.shared),
    );
  } catch {
    // Decoration: a failed read is an empty case, never a broken profile.
    return [];
  }
}

/**
 * A PERSON's case for a public page that knows the person (players.id) but not the login. A person
 * may hold more than one login; the first with any pins is the one shown, at that login's tier.
 */
export async function displayCaseForPlayer(
  playerId: number,
  opts: { publicView?: boolean; accountId?: number } = {},
): Promise<DisplayCaseEntry[]> {
  try {
    const owner = await db
      .select({ userId: displayCaseItems.userId })
      .from(displayCaseItems)
      .innerJoin(users, eq(users.id, displayCaseItems.userId))
      .where(eq(users.playerId, playerId))
      .orderBy(asc(displayCaseItems.userId))
      .limit(1);
    const userId = owner[0]?.userId;
    if (userId == null) return [];
    const supporter = await supporterForUser(userId);
    return displayCaseFor(userId, playerId, supporter?.tier.id, opts);
  } catch {
    return [];
  }
}

/** What they could pin: their collection log and their drops, best first. */
export async function displayCaseCandidates(playerId: number | null): Promise<DisplayCaseCandidate[]> {
  if (playerId == null) return [];
  const accts = await verifiedAccounts(playerId);
  if (accts.length === 0) return [];
  const byId = new Map(accts.map((a) => [a.id, a]));
  const ids = accts.map((a) => a.id);

  const [clog, drops, prices] = await Promise.all([
    db
      .select({ accountId: memberClogItems.accountId, itemId: memberClogItems.itemId, pageName: memberClogItems.pageName, firstSeenAt: memberClogItems.firstSeenAt })
      .from(memberClogItems)
      .where(inArray(memberClogItems.accountId, ids))
      .limit(5000),
    // clan-scope: global -- this person's OWN drops, on their own verified characters, in any clan.
    db
      .select({
        id: moments.id,
        accountId: clanMemberships.accountId,
        itemId: moments.itemId,
        itemName: moments.itemName,
        valueGp: moments.valueGp,
        source: moments.source,
        occurredAt: moments.occurredAt,
      })
      .from(moments)
      .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
      .where(
        and(
          inArray(clanMemberships.accountId, ids),
          inArray(moments.kind, [...DROP_KINDS]),
          isNotNull(moments.itemId),
        ),
      )
      .orderBy(sql`${moments.valueGp} desc nulls last`, desc(moments.occurredAt))
      .limit(400),
    getItemPrices().catch(() => new Map<number, number>()),
  ]);

  const names = clogItemNames();
  const out: DisplayCaseCandidate[] = [];
  // One drop per character and item: the same unique twice is one thing to pin.
  const seenDrop = new Set<string>();
  for (const d of drops) {
    if (d.itemId == null) continue;
    const k = `${d.accountId}:${d.itemId}`;
    if (seenDrop.has(k)) continue;
    seenDrop.add(k);
    out.push({
      key: `drop:${d.id}`,
      kind: 'drop',
      accountId: d.accountId,
      rsn: byId.get(d.accountId)?.rsn ?? '',
      itemId: d.itemId,
      momentId: d.id,
      name: (d.itemName ?? names.get(d.itemId) ?? `Item ${d.itemId}`).slice(0, 80),
      icon: itemIconUrl(d.itemId),
      when: d.occurredAt,
      valueGp: d.valueGp ?? prices.get(d.itemId) ?? null,
      source: d.source ? d.source.slice(0, 80) : null,
    });
  }
  for (const c of clog) {
    out.push({
      key: `clog:${c.accountId}:${c.itemId}`,
      kind: 'clog',
      accountId: c.accountId,
      rsn: byId.get(c.accountId)?.rsn ?? '',
      itemId: c.itemId,
      momentId: null,
      name: names.get(c.itemId) ?? `Item ${c.itemId}`,
      icon: itemIconUrl(c.itemId),
      when: c.firstSeenAt,
      valueGp: prices.get(c.itemId) ?? null,
      source: c.pageName,
    });
  }
  return out;
}

export type PinInput = { kind: 'clog'; accountId: number; itemId: number } | { kind: 'drop'; momentId: number };

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
  return null;
}

export type PinResult = { ok: true; id: number } | { ok: false; status: number; error: string };

/** Pin one item, after proving it is theirs and that a slot is free at their tier now. */
export async function pinToDisplayCase(
  userId: number,
  playerId: number | null,
  tier: SupporterTierId | null | undefined,
  input: PinInput,
): Promise<PinResult> {
  const slots = displayCaseSlots(tier);
  if (slots === 0) return { ok: false, status: 403, error: 'The display case comes with Anvil Supporter.' };
  if (playerId == null) return { ok: false, status: 400, error: 'Link a character first.' };

  const owned = new Map((await verifiedAccounts(playerId)).map((a) => [a.id, a]));
  let accountId: number;
  let itemId: number;
  let momentId: number | null = null;
  if (input.kind === 'clog') {
    if (!owned.has(input.accountId)) return { ok: false, status: 404, error: 'That item is not in your collection log.' };
    const row = await db
      .select({ id: memberClogItems.id })
      .from(memberClogItems)
      .where(and(eq(memberClogItems.accountId, input.accountId), eq(memberClogItems.itemId, input.itemId)))
      .limit(1);
    if (row.length === 0) return { ok: false, status: 404, error: 'That item is not in your collection log.' };
    accountId = input.accountId;
    itemId = input.itemId;
  } else {
    // clan-scope: global -- proving a drop is this person's own; the seat gives its character.
    const row = await db
      .select({ accountId: clanMemberships.accountId, itemId: moments.itemId, kind: moments.kind })
      .from(moments)
      .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
      .where(eq(moments.id, input.momentId))
      .limit(1);
    const m = row[0];
    if (!m || m.itemId == null || !owned.has(m.accountId) || !(DROP_KINDS as readonly string[]).includes(m.kind)) {
      return { ok: false, status: 404, error: 'That drop is not one of yours.' };
    }
    accountId = m.accountId;
    itemId = m.itemId;
    momentId = input.momentId;
  }

  return db.transaction(async (tx) => {
    // Serialise this person's pins so two quick clicks cannot both take the last slot.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('display_case'), ${userId})`);
    const current = await tx
      .select({ id: displayCaseItems.id, position: displayCaseItems.position, kind: displayCaseItems.kind, accountId: displayCaseItems.accountId, itemId: displayCaseItems.itemId, momentId: displayCaseItems.momentId })
      .from(displayCaseItems)
      .where(eq(displayCaseItems.userId, userId));
    const dupe = current.find((c) =>
      input.kind === 'clog'
        ? c.kind === 'clog' && c.accountId === accountId && c.itemId === itemId
        : c.kind === 'drop' && c.momentId === momentId,
    );
    if (dupe) return { ok: true as const, id: dupe.id };
    if (current.length >= Math.min(slots, DISPLAY_CASE_MAX)) {
      return { ok: false as const, status: 409, error: `Your display case is full (${slots} slots). Take one out first.` };
    }
    const position = current.reduce((m, c) => Math.max(m, c.position), -1) + 1;
    const [row] = await tx
      .insert(displayCaseItems)
      .values({ userId, kind: input.kind, accountId, itemId, momentId, position })
      .returning({ id: displayCaseItems.id });
    return { ok: true as const, id: row.id };
  });
}

/** Take one pin out. Allowed at any tier. */
export async function unpinFromDisplayCase(userId: number, id: number): Promise<void> {
  await db.delete(displayCaseItems).where(and(eq(displayCaseItems.userId, userId), eq(displayCaseItems.id, id)));
}

/**
 * Put their pins in this order. Ids that are not theirs are ignored; any of theirs left out keep
 * their relative order after the ones named.
 */
export async function reorderDisplayCase(userId: number, ids: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    const current = await tx
      .select({ id: displayCaseItems.id })
      .from(displayCaseItems)
      .where(eq(displayCaseItems.userId, userId))
      .orderBy(asc(displayCaseItems.position), asc(displayCaseItems.id));
    const mine = new Set(current.map((c) => c.id));
    const named = [...new Set(ids)].filter((id) => mine.has(id));
    const order = [...named, ...current.map((c) => c.id).filter((id) => !named.includes(id))];
    for (let i = 0; i < order.length; i++) {
      await tx
        .update(displayCaseItems)
        .set({ position: i })
        .where(and(eq(displayCaseItems.userId, userId), eq(displayCaseItems.id, order[i])));
    }
  });
}
