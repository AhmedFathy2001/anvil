import { db } from '@/db';
import {
  accounts,
  accountStatSnapshots,
  memberClogItems,
  memberDailyStats,
  memberPersonalBests,
  memberProgress,
  memberProgressItems,
} from '@/db/schema';
import { and, gte, inArray, eq } from 'drizzle-orm';
import { clogItemNames } from '@/lib/clogDataset';
import { combatTasks } from '@/lib/combatTasks';
import { parseItems } from '@/lib/memberProgressItems';
import { bossKeyForName } from '@/lib/capabilityData';
import type { AccountEvidence, CaDone, CaTier } from '@/lib/capability';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Server side of the ability table: gathers AccountEvidence from what Anvil already stores. No new
// tables, no extra hiscores traffic. Every read is keyed by account id, and the caller decides which
// accounts it may look at (the event's own entrants and those people's other accounts — a person's
// know-how is theirs wherever they earned it, but nothing here is ever shown per player).
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** The "recently active" window, in days. */
export const RECENT_DAYS = 30;

const personKeyOfPlayer = (playerId: number) => `u${playerId}`;

function parseSnapshot(json: string | null | undefined): { levels: Record<string, number>; xp: Record<string, number>; kc: Record<string, number> } {
  const out = { levels: {} as Record<string, number>, xp: {} as Record<string, number>, kc: {} as Record<string, number> };
  if (!json) return out;
  try {
    const snap = JSON.parse(json) as { skills?: Record<string, { level?: number; xp?: number }>; bosses?: Record<string, { score?: number } | number> };
    for (const [skill, v] of Object.entries(snap.skills ?? {})) {
      if (v && typeof v.level === 'number' && v.level > 0) out.levels[skill] = v.level;
      if (v && typeof v.xp === 'number' && v.xp > 0) out.xp[skill] = v.xp;
    }
    for (const [key, raw] of Object.entries(snap.bosses ?? {})) {
      const kc = typeof raw === 'number' ? raw : Number(raw?.score ?? 0);
      if (Number.isFinite(kc) && kc > 0) out.kc[key] = kc;
    }
  } catch {
    /* tolerate any historical payload */
  }
  return out;
}

const CA_TIERS: CaTier[] = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'];

/**
 * Evidence for these accounts, plus every OTHER account of the same people (so know-how can cross
 * from a main to the pure they entered). Returns all of them, keyed by account id.
 */
export async function loadAccountEvidence(accountIds: number[]): Promise<Map<number, AccountEvidence>> {
  const out = new Map<number, AccountEvidence>();
  if (!accountIds.length) return out;

  // clan-scope: global -- accounts are platform-wide; the caller scoped the entrant list to its event.
  const entered = await db.select({ playerId: accounts.playerId }).from(accounts).where(inArray(accounts.id, accountIds));
  const people = [...new Set(entered.map((r) => r.playerId))];
  // clan-scope: global -- the same people's other accounts, read for know-how only, never displayed,
  // and only those their owner shares: a character hidden from the profile (accounts.shared = false)
  // is nobody's business, including a balance model's. Entered accounts are always read — the owner
  // put them in this event.
  const rows = (
    await db
      .select({ id: accounts.id, playerId: accounts.playerId, accountType: accounts.accountType, shared: accounts.shared })
      .from(accounts)
      .where(people.length ? inArray(accounts.playerId, people) : inArray(accounts.id, accountIds))
  ).filter((r) => r.shared || accountIds.includes(r.id));
  const ids = rows.map((r) => r.id);
  if (!ids.length) return out;

  const sinceDay = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [snaps, daily, anyDaily, pbs, tiers, caItems, clog] = await Promise.all([
    db.select().from(accountStatSnapshots).where(inArray(accountStatSnapshots.accountId, ids)),
    db
      .select({ accountId: memberDailyStats.accountId, deltas: memberDailyStats.deltas })
      .from(memberDailyStats)
      .where(and(inArray(memberDailyStats.accountId, ids), gte(memberDailyStats.day, sinceDay))),
    db.selectDistinct({ accountId: memberDailyStats.accountId }).from(memberDailyStats).where(inArray(memberDailyStats.accountId, ids)),
    db
      .select({ accountId: memberPersonalBests.accountId, activity: memberPersonalBests.activity, centis: memberPersonalBests.centis })
      .from(memberPersonalBests)
      .where(inArray(memberPersonalBests.accountId, ids)),
    db
      .select({ accountId: memberProgress.accountId, value: memberProgress.value })
      .from(memberProgress)
      .where(and(inArray(memberProgress.accountId, ids), eq(memberProgress.key, 'caTier'))),
    db
      .select({ accountId: memberProgressItems.accountId, payload: memberProgressItems.payload })
      .from(memberProgressItems)
      .where(and(inArray(memberProgressItems.accountId, ids), eq(memberProgressItems.category, 'ca'))),
    db.select({ accountId: memberClogItems.accountId, itemId: memberClogItems.itemId }).from(memberClogItems).where(inArray(memberClogItems.accountId, ids)),
  ]);

  const tracked = new Set(anyDaily.map((r) => r.accountId));
  for (const r of rows) {
    const s = parseSnapshot(snaps.find((x) => x.accountId === r.id)?.snapshot);
    out.set(r.id, {
      accountId: r.id,
      personKey: personKeyOfPlayer(r.playerId),
      accountType: r.accountType,
      ...s,
      recentKc: tracked.has(r.id) ? {} : null,
      recentXp: tracked.has(r.id) ? {} : null,
      pbSeconds: {},
      caTier: null,
      caDone: null,
      clogItems: null,
    });
  }

  for (const d of daily) {
    const ev = out.get(d.accountId);
    if (!ev || !d.deltas) continue;
    try {
      const delta = JSON.parse(d.deltas) as { skills?: Record<string, number>; bosses?: Record<string, number> };
      for (const [k, v] of Object.entries(delta.skills ?? {})) if (v > 0) ev.recentXp![k] = (ev.recentXp![k] ?? 0) + v;
      for (const [k, v] of Object.entries(delta.bosses ?? {})) if (v > 0) ev.recentKc![k] = (ev.recentKc![k] ?? 0) + v;
    } catch {
      /* skip a malformed day */
    }
  }

  for (const p of pbs) {
    const ev = out.get(p.accountId);
    const key = bossKeyForName(p.activity);
    if (!ev || !key || p.centis <= 0) continue;
    const secs = p.centis / 100;
    if (ev.pbSeconds[key] == null || secs < ev.pbSeconds[key]) ev.pbSeconds[key] = secs;
  }

  for (const t of tiers) {
    const ev = out.get(t.accountId);
    if (ev) ev.caTier = t.value;
  }

  for (const c of caItems) {
    const ev = out.get(c.accountId);
    if (!ev) continue;
    const done: CaDone[] = [];
    for (const task of combatTasks(parseItems(c.payload))) {
      if (!task.done) continue;
      const activity = bossKeyForName(task.monster);
      const tier = CA_TIERS.find((x) => x === task.tier);
      if (activity && tier) done.push({ activity, tier, type: task.type ?? 'Kill Count' });
    }
    ev.caDone = done;
  }

  const names = clogItemNames();
  for (const c of clog) {
    const ev = out.get(c.accountId);
    const name = names.get(c.itemId);
    if (!ev || !name) continue;
    (ev.clogItems ??= new Set()).add(name.toLowerCase());
  }
  return out;
}

/** Group evidence by person: the entered accounts' owners and all their accounts. */
export function accountsByPerson(evidence: Map<number, AccountEvidence>): Map<string, AccountEvidence[]> {
  const byPerson = new Map<string, AccountEvidence[]>();
  for (const ev of evidence.values()) {
    const list = byPerson.get(ev.personKey);
    if (list) list.push(ev);
    else byPerson.set(ev.personKey, [ev]);
  }
  return byPerson;
}
