import { inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { clanStandings } from '@/lib/clanLeaderboard';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { compact } from '@/lib/linkText';
import { leaderboardCard } from '@/lib/ogCard';

export const dynamic = 'force-dynamic';

/**
 * The leaderboard's card — this week's top three clans on a podium, each under its own logo.
 *
 * A RANKING IS THE ONE THING WORTH PUTTING IN A PREVIEW. Every other card here describes a page;
 * this one gives away the answer, which is what makes it a link somebody pastes into a clan Discord
 * to argue with. The names are the ones the page already shows, and `clanStandings` refuses to rank
 * a clan that is private, unlisted or unverified (lib/clanListing), so nothing reaches this card
 * that is not already public.
 *
 * One query for both numbers: the whole ranked field, sliced for the podium and counted for the
 * field size. Asking twice would be two aggregates to draw one picture.
 */
export async function GET() {
  const all = await clanStandings('7d', 500);
  const top = all.slice(0, 3);

  // clan-scope: global -- the three clans the public table just ranked, for their logos only.
  const logoRows = top.length
    ? await db.select({ id: clans.id, logoUrl: clans.logoUrl }).from(clans).where(inArray(clans.id, top.map((c) => c.clanId)))
    : [];
  const logoUrl = new Map(logoRows.map((r) => [r.id, r.logoUrl]));
  const logos = await Promise.all(top.map((c) => ourImageAsDataUrl(logoUrl.get(c.clanId), { width: 208, height: 208 }, 'png')));

  return leaderboardCard({
    field: all.length,
    podium: top.map((c, i) => ({ name: c.name, logo: logos[i], stat: `${compact(c.xpGained)} xp` })),
  });
}
