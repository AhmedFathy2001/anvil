import { publicClanHomeView } from '@/lib/clanHome';
import { resolveClanBySlug } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { clanRankFor } from '@/lib/clanLeaderboard';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { clanCard, siteCard } from '@/lib/ogCard';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { isLiveWindow } from '@/lib/linkText';

import { cachedCard } from '@/lib/ogKit';

export const dynamic = 'force-dynamic';

const FOCUS_LABEL: Record<string, string> = {
  pvm: 'PvM',
  skilling: 'Skilling',
  pvp: 'PvP',
  social: 'Social',
  ironman: 'Ironman',
};

/**
 * A clan's social card.
 *
 * THE CLAN'S OWN FACE AND WORDS FIRST: its uploaded logo (else the crest every clan has), its
 * tagline (else the opening of its description), and the focus tags it picked. Then the facts —
 * its standing, its size, what is running now.
 *
 * A CLAN THAT KEEPS TO ITSELF GETS THE GENERIC CARD, not a 404 — the same rule the rest of the app
 * follows for a private clan. An image endpoint that 404s for exactly the private clans would answer
 * "does this clan exist and is it private?" to anybody who can spell a slug, which is the question
 * the setting exists to refuse. A plain Anvil card answers nothing.
 */
async function load(_request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const clan = await resolveClanBySlug(slug);
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return siteCard();

  const [view, name, rank, logo] = await Promise.all([
    publicClanHomeView(clan.id),
    getClanDisplayName(clan.id, clan.name),
    // Null for a clan that is not on the table — unverified, unlisted, or private — so a card can
    // never publish a standing the clan did not agree to be ranked in.
    clanRankFor(clan.id),
    ourImageAsDataUrl(clan.logoUrl, { width: 300, height: 300 }, 'png'),
  ]);
  if (!view) return siteCard();

  const live = view.recentEvents.find((e) => isLiveWindow(e.startDate, e.endDate));
  const chips = [...view.focus.map((f) => FOCUS_LABEL[f]).filter(Boolean), ...(view.recruiting ? ['Recruiting'] : [])].slice(0, 3);

  // A brand-new clan has zeroes for both, and "0 EVENTS" on a card reads as a dead site. Show a
  // counter only once it counts something.
  const stats = [
    ...(view.memberCount > 0 ? [{ value: view.memberCount.toLocaleString('en-US'), label: 'Members' }] : []),
    ...(view.eventsRun > 0 ? [{ value: view.eventsRun.toLocaleString('en-US'), label: 'Events run' }] : []),
    ...(live ? [{ value: 'Live', label: live.name, live: true }] : []),
  ];

  return clanCard({
    name: name || clan.name,
    logo,
    tagline: (view.tagline || view.description || '').trim() || null,
    rank: rank ? `#${rank.rank} of ${rank.field}` : null,
    chips,
    stats,
  });
}

export function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
