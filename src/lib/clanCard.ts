import { normalizeHex } from '@/lib/artPalette';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clans, memberClog } from '@/db/schema';
import { SKILL_LABELS, bossMetricLabel } from '@/lib/constants';
import { getClanAnalytics, listMembers } from '@/lib/memberProfile';
import { momentsForClan } from '@/lib/momentsStore';
import { getActiveWeeklyMetrics } from '@/lib/pluginConfig';
import { getItemMapping } from '@/lib/osrsItems';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { clanBoostLevel } from '@/lib/clanBoosts';
import type { ClanBoostNameStyle } from '@/lib/clanBoostRules';
import { clanTenure, clanTenureLine } from '@/lib/clanTenure';
import { clanStreaks } from '@/lib/activityStreaks';
import { supporterLooksByName } from '@/lib/supporter';
import type { TenureGlyph, TenureStepId } from '@/lib/supporterTiers';

/** What counts as a drop worth showing: pets, uniques and big loot (never a death). */
export const FEED_KINDS = new Set(['pet', 'unique', 'loot']);

// One clan as the plugin panel and the compare page show it: who they are, how hard they played this
// week, who carried it, what dropped lately, and what's running. All from reads the clan pages
// already make — nothing here polls anything.

export interface ClanCard {
  slug: string;
  name: string;
  /** 'creator' for a creator space (lib/creatorSpaces): no members, so none of the numbers below. */
  kind?: 'clan' | 'creator';
  logoUrl: string | null;
  bannerUrl?: string | null;
  bannerPosition?: number | null;
  /** The clan's own colour (picked, else pulled from its art): the hero card's banner when it has none. */
  accent?: string | null;
  boostLevel?: number;
  boostNameStyle?: ClanBoostNameStyle | null;
  /** How long the clan has paid for Anvil without a break (lib/clanTenure); absent when it hasn't. */
  tenure?: { id: TenureStepId; glyph: TenureGlyph; months: number; line: string } | null;
  /** Clan heat: members on a weekly activity streak (lib/activityStreaks). */
  heat?: { on: number; total: number; pct: number } | null;
  /** Members who support Anvil, longest-supporting first (names only; their flair paints itself). */
  supporters?: { names: string[]; count: number };
  members: number;
  /** Members who gained anything in the last 7 days. */
  activeThisWeek: number;
  /** EHP + EHB the members gained over the last 7 days — the week's number. */
  weekHours: number;
  /** Efficient hours, all members, all time. */
  totalEhp: number;
  totalEhb: number;
  /** The week's top three by efficient hours gained. */
  topWeek: { rsn: string; hours: number }[];
  /** Top five accounts by total XP. */
  topPlayers: { rsn: string; overallXp: number }[];
  /** Mean collection log slots across members who've synced, and how many have. */
  clog: { average: number; synced: number } | null;
  /** The last few pets and notable drops in the clan. */
  highlights: { rsn: string; label: string; itemId: number | null; kind: string; at: string }[];
  /** SOTW / BOTW running right now. */
  competitions: { type: string; metric: string; label: string }[];
}


function clanAccent(clan: { accentColor?: string | null; artPalette?: unknown }): string | null {
  const first = (clan.artPalette as { colors?: unknown[] } | null)?.colors?.[0];
  return normalizeHex(clan.accentColor) ?? normalizeHex(first);
}

/** The roster's Supporters, longest unbroken support first. Decoration: a failed read is none. */
async function clanSupporters(rsns: string[]): Promise<{ names: string[]; count: number }> {
  const looks = await supporterLooksByName(rsns).catch(() => ({}) as Awaited<ReturnType<typeof supporterLooksByName>>);
  const names = Object.keys(looks).sort((a, b) => (looks[b].tenure?.months ?? 0) - (looks[a].tenure?.months ?? 0) || a.localeCompare(b));
  return { names: names.slice(0, 10), count: names.length };
}

/** The clan's tenure badge, or null. Decoration: a failed read is no badge. */
async function loadClanTenure(clanId: number): Promise<ClanCard['tenure']> {
  const row = await db
    .select({ plan: clans.plan, paidSince: clans.paidSince, paidEndedAt: clans.paidEndedAt, gumroadSubscriptionId: clans.gumroadSubscriptionId })
    .from(clans)
    .where(eq(clans.id, clanId))
    .then((r) => r[0])
    .catch(() => undefined);
  const t = row ? clanTenure(row) : null;
  return t ? { id: t.step.id, glyph: t.step.glyph, months: t.months, line: clanTenureLine(t) } : null;
}

export async function loadClanCard(clan: {
  id: number;
  slug: string;
  name: string;
  logoUrl: string | null;
  bannerUrl?: string | null;
  bannerPosition?: number | null;
  accentColor?: string | null;
  artPalette?: unknown;
  kind?: string | null;
}): Promise<ClanCard> {
  const boost = await clanBoostLevel(clan.id).catch(() => null);
  const boostLevel = boost?.level ?? 0;
  const boostNameStyle = boost?.nameStyle ?? null;
  // A creator space has no roster to count, rank or compare: the card is who it is, nothing more.
  if (isCreatorSpace(clan)) {
    return {
      slug: clan.slug,
      name: clan.name,
      kind: 'creator',
      logoUrl: clan.logoUrl,
      bannerUrl: clan.bannerUrl ?? null,
      bannerPosition: clan.bannerPosition ?? null,
      accent: clanAccent(clan),
      boostLevel,
      boostNameStyle,
      members: 0,
      activeThisWeek: 0,
      weekHours: 0,
      totalEhp: 0,
      totalEhb: 0,
      topWeek: [],
      topPlayers: [],
      clog: null,
      highlights: [],
      competitions: [],
    };
  }
  const members = await listMembers(clan.id);
  const roster = members.filter((m) => !m.isGuest);
  const [analytics, moments, weekly, clogRows] = await Promise.all([
    getClanAnalytics(members),
    momentsForClan(clan.id, 12),
    getActiveWeeklyMetrics(clan.id),
    roster.length
      ? db
          .select({ obtained: memberClog.obtained })
          .from(memberClog)
          .where(inArray(memberClog.accountId, roster.map((m) => m.accountId)))
      : Promise.resolve([] as { obtained: number }[]),
  ]);

  const synced = clogRows.filter((r) => r.obtained > 0);
  // Pets and clog-only items arrive by NAME (a chat line), so their moment carries no item id and the
  // plugin drew a blank where the icon goes. Resolve them by name against the item list (which holds
  // untradeables too, and prefers the collection-log id). An outage just leaves the gap, as before.
  const highlightMoments = moments.filter((m) => FEED_KINDS.has(m.kind)).slice(0, 5);
  const idByName = new Map<string, number>();
  if (highlightMoments.some((m) => m.itemId == null && m.itemName)) {
    try {
      for (const it of await getItemMapping()) idByName.set(it.name.toLowerCase(), it.id);
    } catch {
      /* no icons this time; the names still read */
    }
  }
  return {
    slug: clan.slug,
    name: clan.name,
    logoUrl: clan.logoUrl,
    bannerUrl: clan.bannerUrl ?? null,
    bannerPosition: clan.bannerPosition ?? null,
      accent: clanAccent(clan),
    boostLevel,
    boostNameStyle,
    tenure: await loadClanTenure(clan.id),
    supporters: await clanSupporters(roster.map((m) => m.rsn)),
    heat: await clanStreaks(clan.id)
      .then((h) => (h.total ? { on: h.on, total: h.total, pct: h.heat } : null))
      .catch(() => null),
    members: analytics.memberCount,
    activeThisWeek: analytics.activeThisWeek,
    weekHours: Math.round(analytics.activity.slice(-7).reduce((t, d) => t + d.value, 0) * 10) / 10,
    totalEhp: Math.round(analytics.totalEhp * 10) / 10,
    totalEhb: Math.round(analytics.totalEhb * 10) / 10,
    topWeek: analytics.topWeek.slice(0, 3).map((t) => ({ rsn: t.rsn, hours: Math.round(t.hours * 10) / 10 })),
    topPlayers: roster
      .filter((m) => (m.overallXp ?? 0) > 0)
      .sort((a, b) => (b.overallXp ?? 0) - (a.overallXp ?? 0))
      .slice(0, 5)
      .map((m) => ({ rsn: m.rsn, overallXp: m.overallXp ?? 0 })),
    clog: synced.length
      ? { average: Math.round(synced.reduce((t, r) => t + r.obtained, 0) / synced.length), synced: synced.length }
      : null,
    // Pets and drops only — a death is a moment, not a highlight.
    highlights: highlightMoments.map((m) => ({
      rsn: m.rsn,
      label: m.itemName ?? m.source ?? m.kind,
      itemId: m.itemId ?? (m.itemName ? idByName.get(m.itemName.toLowerCase()) ?? null : null),
      kind: m.kind,
      at: m.occurredAt,
    })),
    competitions: weekly.map((c) => ({
      type: c.type,
      metric: c.metric,
      label: c.type === 'skill' ? SKILL_LABELS[c.metric] ?? c.metric : c.type === 'boss' ? bossMetricLabel(c.metric) || c.metric : c.metric.toUpperCase(),
    })),
  };
}

/** Many clans' tenure badges at once (the /clans directory), keyed by clan id; only clans that have one. */
export async function clanTenureBadges(ids: number[]): Promise<Map<number, { id: TenureStepId; months: number; line: string }>> {
  const out = new Map<number, { id: TenureStepId; months: number; line: string }>();
  const want = [...new Set(ids)].filter((n) => Number.isInteger(n) && n > 0);
  if (want.length === 0) return out;
  const rows = await db
    .select({ cid: clans.id, plan: clans.plan, paidSince: clans.paidSince, paidEndedAt: clans.paidEndedAt, gumroadSubscriptionId: clans.gumroadSubscriptionId })
    .from(clans)
    .where(inArray(clans.id, want));
  for (const r of rows) {
    const t = clanTenure(r);
    if (t && t.months >= 1) out.set(r.cid, { id: t.step.id, months: t.months, line: clanTenureLine(t) });
  }
  return out;
}
