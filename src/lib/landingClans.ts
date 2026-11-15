import { directoryClans } from '@/lib/apexDirectory';
import { pickShowcaseClans, type ShowcaseClan } from '@/lib/landingClansRules';

const TTL_MS = 60_000;
let cached: { at: number; value: Promise<ShowcaseClan[]> } | null = null;

/**
 * Clans that were active this week, for the signed-out landing. Shares one answer for a minute for
 * the same reason lib/platformStats does: crawlers arrive in bursts and each directory read is
 * several queries. A failed read is an empty row, never a broken page.
 */
export function landingClans(): Promise<ShowcaseClan[]> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  const value = directoryClans()
    .then((rows) =>
      pickShowcaseClans(rows).map((r) => ({
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
