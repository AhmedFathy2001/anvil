import { directoryClans } from '@/lib/apexDirectory';
import { pickRecruitingClans, pickShowcaseClans, type ShowcaseClan } from '@/lib/landingClansRules';

const TTL_MS = 60_000;
let cached: { at: number; value: Promise<ShowcaseClan[]> } | null = null;

/**
 * Every listed clan, trimmed to what the landing and the clanless home show. One shared answer for a
 * minute, for the same reason lib/platformStats does: crawlers arrive in bursts and each directory
 * read is several queries. A failed read is an empty list, never a broken page.
 */
function listed(): Promise<ShowcaseClan[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = directoryClans()
    .then((rows) =>
      rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        logoUrl: r.logoUrl ?? null,
        members: r.members,
        activeThisWeek: r.activeThisWeek,
        recruiting: r.recruiting ?? false,
        tagline: r.tagline ?? null,
      })),
    )
    .catch(() => [] as ShowcaseClan[]);
  cached = { at: now, value };
  return value;
}

/** Clans that were active this week, for the signed-out landing. */
export async function landingClans(): Promise<ShowcaseClan[]> {
  return pickShowcaseClans(await listed());
}

/** Clans taking members, for a signed-in player who is in none. */
export async function recruitingClans(): Promise<ShowcaseClan[]> {
  return pickRecruitingClans(await listed());
}
