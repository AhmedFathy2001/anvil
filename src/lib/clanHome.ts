// The public clan home — what a stranger sees at /c/<slug> before they're a member.
//
// The member-facing week view (lib/homeView) answers "what's happening for me this week". This
// answers a different question — "what IS this clan, and do I want in" — so it's a separate, lean
// read: the profile fields the clan wrote about itself, plus a few counts and its recent events to
// show it's alive. No heavy aggregation; the standings page already owns cross-clan ranking.

import { clanTenure, clanTenureLine } from '@/lib/clanTenure';
import type { TenureStepId } from '@/lib/supporterTiers';
import { normalizeHex } from '@/lib/artPalette';
import { clanMoments } from '@/lib/clanMoments';
import type { Moment } from '@/lib/clanMomentsRules';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clans, events } from '@/db/schema';
import { listClanEvents } from '@/lib/clanEvents';
import { loadHubView, weeklyValueText } from '@/lib/eventsHub';
import { getClanAnalytics, listMembers } from '@/lib/memberProfile';

export type ClanFocus = 'pvm' | 'skilling' | 'pvp' | 'social' | 'ironman';

export interface ClanRequirements {
  minTotal?: number;
  minEhp?: number;
  region?: string;
  timezone?: string;
}

export interface PublicClanHome {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  focus: ClanFocus[];
  requirements: ClanRequirements;
  verified: boolean;
  /** How long it has paid for Anvil without a break (lib/clanTenure), or null. */
  tenure: { id: TenureStepId; months: number; line: string } | null;
  /** The clan's own image, or null for the generated crest. */
  logoUrl: string | null;
  /** The clan's wide 3:1 banner (may be animated) and its vertical focus, 0–100; null = none / centred. */
  bannerUrl: string | null;
  bannerPosition: number | null;
  /** Its picked colour (lib/artPalette), or null for Anvil gold. */
  accent: string | null;
  recruiting: boolean;
  openToChallenges: boolean;
  guestPolicy: string;
  memberCount: number;
  eventsRun: number;
  recentEvents: { id: number; name: string; startDate: string | null; endDate: string | null }[];
  discordInvite: string | null;
}

export function asFocus(raw: unknown): ClanFocus[] {
  const ok: ClanFocus[] = ['pvm', 'skilling', 'pvp', 'social', 'ironman'];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is ClanFocus => typeof x === 'string' && (ok as string[]).includes(x));
}

function asRequirements(raw: unknown): ClanRequirements {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: ClanRequirements = {};
  if (typeof r.minTotal === 'number') out.minTotal = r.minTotal;
  if (typeof r.minEhp === 'number') out.minEhp = r.minEhp;
  if (typeof r.region === 'string' && r.region.trim()) out.region = r.region.trim();
  if (typeof r.timezone === 'string' && r.timezone.trim()) out.timezone = r.timezone.trim();
  return out;
}

/**
 * Assemble the public home for one clan. `discordInvite` is passed in by the caller (it already reads
 * the clan's settings for the member view) rather than fetched twice.
 */
function tenureOf(clan: Parameters<typeof clanTenure>[0]): PublicClanHome['tenure'] {
  const t = clanTenure(clan);
  return t && t.months >= 1 ? { id: t.step.id, months: t.months, line: clanTenureLine(t) } : null;
}

export async function publicClanHomeView(clanId: number, discordInvite: string | null = null): Promise<PublicClanHome | null> {
  // clan-scope: global -- addressed by clan id (the page's own clan); this reads that clan's own row.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return null;

  // MEMBER SEATS — the same count the Clan Hall card (lib/apexDirectory) and the members' own home
  // (lib/homeView) show. This counted live rows whose ACCOUNT status was 'active', which is Jagex-side
  // health, not membership: guests were counted, and every member the hiscores had not found yet was
  // not — a clan was "10 members" on its Clan Hall card and "1 member" one click later.
  const [memberRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.kind, 'member'), isNull(clanRoster.leftAt)));

  const [eventRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(eq(events.clanId, clanId));

  const recent = await db
    .select({ id: events.id, name: events.name, startDate: events.startDate, endDate: events.endDate })
    .from(events)
    .where(eq(events.clanId, clanId))
    .orderBy(desc(events.startDate))
    .limit(4);

  return {
    id: clan.id,
    slug: clan.slug,
    name: clan.name,
    tagline: clan.tagline,
    description: clan.description,
    focus: asFocus(clan.focus),
    requirements: asRequirements(clan.requirements),
    verified: clan.ingameNameVerifiedAt != null,
    tenure: tenureOf(clan),
    logoUrl: clan.logoUrl ?? null,
    bannerUrl: clan.bannerUrl ?? null,
    bannerPosition: clan.bannerPosition ?? null,
    accent: normalizeHex(clan.accentColor),
    recruiting: clan.recruiting,
    openToChallenges: clan.openToChallenges,
    guestPolicy: clan.guestPolicy,
    memberCount: memberRow?.n ?? 0,
    eventsRun: eventRow?.n ?? 0,
    recentEvents: recent,
    discordInvite,
  };
}

// ── What a visitor can open ──────────────────────────────────────────────────────────────────────
//
// The public home used to list event NAMES that went nowhere, and its only leaderboard link left for
// the all-clans table. A visitor deciding whether to join wants to watch what's on and see who plays
// here, so this gathers the clan's live, coming and finished competitions (boards and weeks, each with
// a link) and its own week's top players. Invited-only boards are left out: a stranger can't open them.

export interface VisitorItem {
  key: string;
  href: string;
  name: string;
  /** "Bingo", "Boss of the week", "Clan event". */
  kind: string;
  /** One line under the name: standings, entrants, when. */
  line: string;
  /** Leader while live, winner once finished. */
  top: { name: string; text: string } | null;
  when: string | null;
}

export interface PublicClanActivity {
  live: VisitorItem[];
  upcoming: VisitorItem[];
  past: VisitorItem[];
  week: { top: { rsn: string; hours: number }[]; activeThisWeek: number };
  /** What its members did lately: pets, log slots, 99s, maxes (lib/clanMoments). */
  moments: Moment[];
}

const WEEK_KIND: Record<string, string> = { SOTW: 'Skill of the week', BOTW: 'Boss of the week', EOTW: 'Efficiency of the week' };

export async function publicClanActivity(clanId: number, now = new Date()): Promise<PublicClanActivity> {
  const [hub, clanEvts, members, moments] = await Promise.all([
    loadHubView(clanId, { pastLimit: 6 }, now),
    listClanEvents(clanId, { now: now.getTime(), withinDays: 14 }).catch(() => []),
    listMembers(clanId),
    // A wall that fails to load is a page without the wall, never a page that fails.
    clanMoments(clanId, now).catch(() => [] as Moment[]),
  ]);
  // Every board on the page, whichever clan HOSTS it: the hub includes boards this clan only
  // co-hosts, so a check limited to this clan's own events would let another clan's invited-only
  // board through.
  const boardIds = [
    ...hub.live.boards.map((b) => b.id),
    ...hub.upcoming.boards.map((b) => b.id),
    ...hub.record.items.filter((i) => i.group === 'boards').map((i) => i.id),
  ];
  const invited = boardIds.length
    ? await db
        .select({ id: events.id })
        .from(events)
        // clan-scope: global -- these ids are the boards this clan's hub already lists (hosted or co-hosted).
        .where(and(inArray(events.id, boardIds), eq(events.visibility, 'invited')))
    : [];
  const hidden = new Set(invited.map((r) => r.id));
  const analytics = await getClanAnalytics(members).catch(() => null);

  const board = (b: (typeof hub.live.boards)[number]): VisitorItem => ({
    key: `e${b.id}`,
    href: `/events/${b.id}`,
    name: b.name,
    kind: b.shape,
    line: [b.chips[0], b.foot].filter(Boolean).join(' · '),
    top: b.top ? { name: b.top.name, text: `${b.top.score.toLocaleString('en-US')} ${b.top.unit}` } : null,
    when: b.startDate,
  });
  const week = (w: (typeof hub.live.weeks)[number]): VisitorItem => ({
    key: `w${w.id}`,
    href: `/weekly/${w.id}`,
    name: w.name,
    kind: WEEK_KIND[w.kind] ?? 'Competition',
    line: `${w.entrants} entered`,
    top: w.top ? { name: w.top.rsn, text: weeklyValueText(w.unit, w.top.value) } : null,
    when: w.state === 'upcoming' ? w.startDate : w.endDate,
  });

  return {
    live: [...hub.live.weeks.map(week), ...hub.live.boards.filter((b) => !hidden.has(b.id)).map(board)],
    upcoming: [
      ...hub.upcoming.boards.filter((b) => !hidden.has(b.id)).map(board),
      ...hub.upcoming.weeks.map(week),
      ...clanEvts.map((e) => ({
        key: `c${e.id}`,
        href: `/clan-events/${e.id}`,
        name: e.title,
        kind: 'Clan event',
        line: [e.location, e.world ? `W${e.world}` : null].filter(Boolean).join(' · '),
        top: null,
        when: e.occurrence.start,
      })),
    ].sort((a, b) => (a.when ?? '').localeCompare(b.when ?? '')),
    past: hub.record.items
      .filter((i) => !(i.group === 'boards' && hidden.has(i.id)))
      .slice(0, 5)
      .map((i) => ({
        key: i.key,
        href: i.href,
        name: i.name,
        kind: i.group === 'weeks' ? 'Competition' : 'Event',
        line: `${i.entrants} ${i.entrantLabel}`,
        top: i.top ? { name: i.top.name, text: i.top.text } : null,
        when: i.endDate ?? i.startDate,
      })),
    week: { top: (analytics?.topWeek ?? []).slice(0, 5), activeThisWeek: analytics?.activeThisWeek ?? 0 },
    moments,
  };
}
