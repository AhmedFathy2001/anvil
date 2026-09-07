import { clanStandings } from '@/lib/clanLeaderboard';
import { ogCard } from '@/lib/ogCard';

export const dynamic = 'force-dynamic';

/**
 * The leaderboard's card — the top three clans, by name, this week.
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

  if (top.length === 0) {
    return ogCard({
      eyebrow: 'Hall of Records',
      title: 'OSRS Clan Leaderboard',
      subtitle: 'Clans ranked by experience, efficient hours and bossing.',
    });
  }

  return ogCard({
    eyebrow: 'Hall of Records · This week',
    title: 'OSRS Clan Leaderboard',
    // The podium read as a line rather than drawn as a table — a card is seen at thumbnail size, and
    // three columns at that scale are three unreadable columns. Separated by a mark rather than by
    // spaces: the renderer collapses runs of whitespace, so "1. Rival  2. The AFK Spot" came out as
    // one unbroken sentence with no visible break between the places.
    subtitle: top.map((c, i) => `${i + 1}. ${c.name}`).join(' · '),
    stats: [{ label: 'Clans ranked', value: all.length.toLocaleString() }],
  });
}
