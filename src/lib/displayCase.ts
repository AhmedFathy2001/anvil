// The display case: a row of a person's best drops, kill counts and times on their profile (Anvil Supporter — 4 slots,
// Champion 8, Patron 12). The slot count is lib/profileMediaRules; this is the database half.
//
// PINS COME FROM THEIR OWN VERIFIED RECORD, never from a typed-in item: an obtained collection-log
// slot the plugin reported (member_clog_items), a drop moment (moments), a boss kill count (the
// hiscores snapshot raised by the plugin's live push — account_stat_snapshots + accounts.live_stats)
// or a personal best the plugin reported (member_personal_bests), on a character that is theirs and
// proven theirs. All are re-checked on every read, so a character that leaves them, an item that
// drops out of the log, or a deleted moment stops showing with no write — and a kill count or a time
// shows its CURRENT value, never the one at pinning.
//
// PRIVACY. A pin names the character it came from. On a public page that is only allowed for a
// character its owner SHARES — the same rule as /u/ and /p/ — so a pin from a private character is
// shown to its owner alone, and never tells a stranger that the private character exists.

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import {
  accounts,
  accountStatSnapshots,
  clanMemberships,
  displayCaseItems,
  memberClogItems,
  memberPersonalBests,
  moments,
  users,
} from '@/db/schema';
import { clogItemNames, clogPageOfItem } from '@/lib/clogDataset';
import { getItemPrices } from '@/lib/itemPrices';
import { activityImageUrl, bossIconForStatKey, itemIconUrl, wikiImageUrl } from '@/lib/tileIcons';
import {
  bossKillcounts,
  formatPersonalBest,
  kcHeadline,
  kcLabel,
  parsePbStatKey,
  pbLabel,
  pbStatKey,
  type PinInput,
  type PinKind,
} from '@/lib/displayCaseStats';
import { supporterForUser } from '@/lib/supporter';
import { DISPLAY_CASE_MAX, displayCaseSlots, visiblePins } from '@/lib/profileMediaRules';
import type { SupporterTierId } from '@/lib/supporterTiers';

/** The moment kinds that are an item worth showing off. */
const DROP_KINDS = ['pet', 'unique', 'loot', 'clog'] as const;

export { parsePinInput, type PinInput } from '@/lib/displayCaseStats';

/** Shown when a boss or activity has no picture of its own. */
const STAT_FALLBACK_ICON = wikiImageUrl('Stats_icon.png');

export interface DisplayCaseEntry {
  id: number;
  position: number;
  kind: PinKind;
  accountId: number;
  rsn: string;
  /** The character is published (accounts.shared); only these show to anybody but the owner. */
  shared: boolean;
  /** 0 for a kill count or a time. */
  itemId: number;
  /** 'kc' / 'pb' only: what the pin is of (lib/displayCaseStats). */
  statKey: string | null;
  /** 'kc' / 'pb' only: the main text, "12 KC" / "1:52.40" — the value NOW. */
  headline: string | null;
  name: string;
  icon: string;
  /** When it happened, if known: the drop's time, when the log first showed it, when the time was set. */
  when: string | null;
  kc: number | null;
  /** A log item: how many they own. */
  qty?: number | null;
  /** GE value (the drop's own price, else today's mid). Null for untradeables. */
  valueGp: number | null;
  /** Where it came from: the log page or the drop's source. */
  source: string | null;
  /** The record that backs it: the character's collection-log page, when that page is public. */
  proofHref: string | null;
}

export interface DisplayCaseCandidate {
  key: string;
  kind: PinKind;
  accountId: number;
  rsn: string;
  itemId: number;
  momentId: number | null;
  statKey: string | null;
  headline: string | null;
  /** 'kc' only: the count, for sorting. */
  kc: number | null;
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

/** Each character's boss kill counts now (hiscores raised by the live push), above zero only. */
async function killcountsOf(accountIds: number[]): Promise<Map<number, Map<string, number>>> {
  const out = new Map<number, Map<string, number>>();
  const ids = [...new Set(accountIds)];
  if (ids.length === 0) return out;
  const rows = await db
    .select({ id: accounts.id, live: accounts.liveStats, snapshot: accountStatSnapshots.snapshot })
    .from(accounts)
    .leftJoin(accountStatSnapshots, eq(accountStatSnapshots.accountId, accounts.id))
    .where(inArray(accounts.id, ids));
  for (const r of rows) out.set(r.id, bossKillcounts(r.snapshot, r.live));
  return out;
}

interface Best {
  activity: string;
  teamSize: number;
  centis: number;
  at: string | null;
}

/** Each character's personal bests, keyed by the pin's stat key. */
async function bestsOf(accountIds: number[]): Promise<Map<number, Map<string, Best>>> {
  const out = new Map<number, Map<string, Best>>();
  const ids = [...new Set(accountIds)];
  if (ids.length === 0) return out;
  const rows = await db
    .select({
      accountId: memberPersonalBests.accountId,
      activity: memberPersonalBests.activity,
      teamSize: memberPersonalBests.teamSize,
      centis: memberPersonalBests.centis,
      achievedAt: memberPersonalBests.achievedAt,
      updatedAt: memberPersonalBests.updatedAt,
    })
    .from(memberPersonalBests)
    .where(inArray(memberPersonalBests.accountId, ids))
    .limit(5000);
  for (const r of rows) {
    if (!(r.centis > 0)) continue;
    const m = out.get(r.accountId) ?? new Map<string, Best>();
    m.set(pbStatKey(r.activity, r.teamSize), { activity: r.activity, teamSize: r.teamSize, centis: r.centis, at: r.achievedAt ?? r.updatedAt ?? null });
    out.set(r.accountId, m);
  }
  return out;
}

function kcIcon(key: string): string {
  return bossIconForStatKey(key) ?? STAT_FALLBACK_ICON;
}

function pbIcon(activity: string): string {
  return activityImageUrl(activity) ?? STAT_FALLBACK_ICON;
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
          quantity: memberClogItems.quantity,
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

  // A log slot that was already filled when tracking began has no date of its own. When the site did
  // record that drop (a moment for the same character and item), its date and kill count are the real
  // "when" — shown instead of "before tracking".
  const undated = clogRows.filter((r) => r.firstSeenAt == null);
  // clan-scope: global -- the person's own drops on their own characters, as for dropRows below.
  const firstDrops = undated.length
    ? await db
        .select({
          accountId: clanMemberships.accountId,
          itemId: moments.itemId,
          occurredAt: sql<string>`min(${moments.occurredAt})`,
          kc: sql<number | null>`(array_agg(${moments.kc} order by ${moments.occurredAt}))[1]`,
        })
        .from(moments)
        .innerJoin(clanMemberships, eq(clanMemberships.id, moments.clanMemberId))
        .where(
          and(
            inArray(clanMemberships.accountId, [...new Set(undated.map((r) => r.accountId))]),
            inArray(moments.itemId, [...new Set(undated.map((r) => r.itemId))]),
            inArray(moments.kind, [...DROP_KINDS]),
          ),
        )
        .groupBy(clanMemberships.accountId, moments.itemId)
    : [];
  const firstDropByKey = new Map(firstDrops.map((r) => [`${r.accountId}:${r.itemId}`, r]));

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

  const kcPins = live.filter((p) => p.kind === 'kc' && p.statKey);
  const pbPins = live.filter((p) => p.kind === 'pb' && p.statKey);
  const [kcByAccount, bestsByAccount] = await Promise.all([
    killcountsOf(kcPins.map((p) => p.accountId)),
    bestsOf(pbPins.map((p) => p.accountId)),
  ]);

  const names = clogItemNames();
  const prices = await getItemPrices().catch(() => new Map<number, number>());
  const out: DisplayCaseEntry[] = [];
  for (const p of live) {
    const acct = owned.get(p.accountId)!;
    const base = {
      id: p.id,
      position: p.position,
      accountId: p.accountId,
      rsn: acct.rsn,
      shared: !!acct.shared,
      itemId: p.itemId,
      statKey: null,
      headline: null,
    };
    if (p.kind === 'kc' || p.kind === 'pb') {
      const key = p.statKey;
      if (!key) continue;
      if (p.kind === 'kc') {
        const kc = kcByAccount.get(p.accountId)?.get(key);
        if (!kc) continue;
        out.push({ ...base, kind: 'kc', statKey: key, headline: kcHeadline(kc), name: kcLabel(key), icon: kcIcon(key), when: null, kc, valueGp: null, source: null, proofHref: null });
      } else {
        const best = bestsByAccount.get(p.accountId)?.get(key);
        if (!best) continue;
        out.push({
          ...base,
          kind: 'pb',
          statKey: key,
          headline: formatPersonalBest(best.centis),
          name: pbLabel(best.activity, best.teamSize),
          icon: pbIcon(best.activity),
          when: best.at,
          kc: null,
          valueGp: null,
          source: null,
          proofHref: null,
        });
      }
      continue;
    }
    const proofHref = acct.shared ? clogHref(acct.rsn, p.itemId) : null;
    if (p.kind === 'clog') {
      const row = clogByKey.get(`${p.accountId}:${p.itemId}`);
      if (!row) continue;
      const dropped = row.firstSeenAt == null ? firstDropByKey.get(`${p.accountId}:${p.itemId}`) : undefined;
      out.push({
        ...base,
        kind: 'clog',
        name: names.get(p.itemId) ?? `Item ${p.itemId}`,
        icon: itemIconUrl(p.itemId),
        when: row.firstSeenAt ?? dropped?.occurredAt ?? null,
        kc: row.kc ?? dropped?.kc ?? null,
        qty: row.quantity,
        valueGp: prices.get(p.itemId) ?? null,
        source: row.pageName,
        proofHref,
      });
    } else if (p.kind === 'drop') {
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

/** What they could pin: their drops, collection log, kill counts and personal bests. */
export async function displayCaseCandidates(playerId: number | null): Promise<DisplayCaseCandidate[]> {
  if (playerId == null) return [];
  const accts = await verifiedAccounts(playerId);
  if (accts.length === 0) return [];
  const byId = new Map(accts.map((a) => [a.id, a]));
  const ids = accts.map((a) => a.id);

  const [clog, drops, prices, kcs, bests] = await Promise.all([
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
        kc: moments.kc,
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
    killcountsOf(ids),
    bestsOf(ids),
  ]);

  const names = clogItemNames();
  const out: DisplayCaseCandidate[] = [];
  const statBase = { itemId: 0, momentId: null, valueGp: null, source: null };
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
      statKey: null,
      headline: null,
      kc: d.kc ?? null,
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
      statKey: null,
      headline: null,
      kc: null,
      name: names.get(c.itemId) ?? `Item ${c.itemId}`,
      icon: itemIconUrl(c.itemId),
      when: c.firstSeenAt,
      valueGp: prices.get(c.itemId) ?? null,
      source: c.pageName,
    });
  }
  for (const a of accts) {
    for (const [key, kc] of kcs.get(a.id) ?? []) {
      out.push({ ...statBase, key: `kc:${a.id}:${key}`, kind: 'kc', accountId: a.id, rsn: a.rsn, statKey: key, headline: kcHeadline(kc), kc, name: kcLabel(key), icon: kcIcon(key), when: null });
    }
    for (const [key, b] of bests.get(a.id) ?? []) {
      out.push({
        ...statBase,
        key: `pb:${a.id}:${key}`,
        kind: 'pb',
        accountId: a.id,
        rsn: a.rsn,
        statKey: key,
        headline: formatPersonalBest(b.centis),
        kc: null,
        name: pbLabel(b.activity, b.teamSize),
        icon: pbIcon(b.activity),
        when: b.at,
      });
    }
  }
  return out;
}

export type PinResult = { ok: true; id: number } | { ok: false; status: number; error: string };

/** Pin one item, kill count or time, after proving it is theirs and that a slot is free at their tier now. */
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
  let statKey: string | null = null;
  if (input.kind === 'kc' || input.kind === 'pb') {
    const missing = input.kind === 'kc' ? 'That kill count is not on your character.' : 'That time is not one of your personal bests.';
    if (!owned.has(input.accountId)) return { ok: false, status: 404, error: missing };
    if (input.kind === 'kc') {
      // Only a count above zero: a pin of nothing is not a record.
      const kc = (await killcountsOf([input.accountId])).get(input.accountId)?.get(input.statKey);
      if (!kc) return { ok: false, status: 404, error: missing };
    } else {
      const pb = parsePbStatKey(input.statKey)!;
      const row = await db
        .select({ id: memberPersonalBests.id })
        .from(memberPersonalBests)
        .where(
          and(
            eq(memberPersonalBests.accountId, input.accountId),
            eq(memberPersonalBests.activity, pb.activity),
            eq(memberPersonalBests.teamSize, pb.teamSize),
          ),
        )
        .limit(1);
      if (row.length === 0) return { ok: false, status: 404, error: missing };
    }
    accountId = input.accountId;
    itemId = 0;
    statKey = input.statKey;
  } else if (input.kind === 'clog') {
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
      .select({
        id: displayCaseItems.id,
        position: displayCaseItems.position,
        kind: displayCaseItems.kind,
        accountId: displayCaseItems.accountId,
        itemId: displayCaseItems.itemId,
        momentId: displayCaseItems.momentId,
        statKey: displayCaseItems.statKey,
      })
      .from(displayCaseItems)
      .where(eq(displayCaseItems.userId, userId));
    const dupe = current.find((c) =>
      input.kind === 'clog'
        ? c.kind === 'clog' && c.accountId === accountId && c.itemId === itemId
        : input.kind === 'drop'
          ? c.kind === 'drop' && c.momentId === momentId
          : c.kind === input.kind && c.accountId === accountId && c.statKey === statKey,
    );
    if (dupe) return { ok: true as const, id: dupe.id };
    if (current.length >= Math.min(slots, DISPLAY_CASE_MAX)) {
      return { ok: false as const, status: 409, error: `Your display case is full (${slots} slots). Take one out first.` };
    }
    const position = current.reduce((m, c) => Math.max(m, c.position), -1) + 1;
    const [row] = await tx
      .insert(displayCaseItems)
      .values({ userId, kind: input.kind, accountId, itemId, momentId, statKey, position })
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
