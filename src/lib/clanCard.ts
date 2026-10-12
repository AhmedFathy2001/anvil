import { inArray } from 'drizzle-orm';

import { db } from '@/db';
import { memberClog } from '@/db/schema';
import { BOSSES, SKILL_LABELS } from '@/lib/constants';
import { getClanAnalytics, listMembers } from '@/lib/memberProfile';
import { momentsForClan } from '@/lib/momentsStore';
import { getActiveWeeklyMetrics } from '@/lib/pluginConfig';

// One clan as the plugin panel and the compare page show it: who they are, how hard they played this
// week, who carried it, what dropped lately, and what's running. All from reads the clan pages
// already make — nothing here polls anything.

export interface ClanCard {
  slug: string;
  name: string;
  logoUrl: string | null;
  members: number;
  /** Members who gained anything in the last 7 days. */
  activeThisWeek: number;
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

const bossLabel = new Map(BOSSES.map((b) => [b.key, b.label]));

export async function loadClanCard(clan: { id: number; slug: string; name: string; logoUrl: string | null }): Promise<ClanCard> {
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
  return {
    slug: clan.slug,
    name: clan.name,
    logoUrl: clan.logoUrl,
    members: analytics.memberCount,
    activeThisWeek: analytics.activeThisWeek,
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
    highlights: moments
      .filter((m) => m.kind === 'pet' || m.kind === 'drop')
      .slice(0, 5)
      .map((m) => ({ rsn: m.rsn, label: m.itemName ?? m.source ?? m.kind, itemId: m.itemId, kind: m.kind, at: m.occurredAt })),
    competitions: weekly.map((c) => ({
      type: c.type,
      metric: c.metric,
      label: c.type === 'skill' ? SKILL_LABELS[c.metric] ?? c.metric : c.type === 'boss' ? bossLabel.get(c.metric) ?? c.metric : c.metric.toUpperCase(),
    })),
  };
}
