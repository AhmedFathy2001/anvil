// The public clan home — what a stranger sees at /c/<slug> before they're a member.
//
// The member-facing week view (lib/homeView) answers "what's happening for me this week". This
// answers a different question — "what IS this clan, and do I want in" — so it's a separate, lean
// read: the profile fields the clan wrote about itself, plus a few counts and its recent events to
// show it's alive. No heavy aggregation; the standings page already owns cross-clan ranking.

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, clans, events } from '@/db/schema';

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
  recruiting: boolean;
  openToChallenges: boolean;
  guestPolicy: string;
  memberCount: number;
  eventsRun: number;
  recentEvents: { id: number; name: string; startDate: string | null; endDate: string | null }[];
  discordInvite: string | null;
}

function asFocus(raw: unknown): ClanFocus[] {
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
export async function publicClanHomeView(clanId: number, discordInvite: string | null = null): Promise<PublicClanHome | null> {
  // clan-scope: global -- addressed by clan id (the page's own clan); this reads that clan's own row.
  const clan = await db.query.clans.findFirst({ where: eq(clans.id, clanId) });
  if (!clan) return null;

  const [memberRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clanRoster)
    .where(and(eq(clanRoster.clanId, clanId), eq(clanRoster.status, 'active'), isNull(clanRoster.leftAt)));

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
    recruiting: clan.recruiting,
    openToChallenges: clan.openToChallenges,
    guestPolicy: clan.guestPolicy,
    memberCount: memberRow?.n ?? 0,
    eventsRun: eventRow?.n ?? 0,
    recentEvents: recent,
    discordInvite,
  };
}
