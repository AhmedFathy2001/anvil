import { apexCharacter } from '@/lib/apexProfiles';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { getMonthlyWrapped } from '@/lib/monthlyWrapped';
import { getYearlyWrapped } from '@/lib/yearlyWrapped';
import { yearlyCardStats, yearlyHighlights } from '@/lib/yearlyWrappedRules';
import {
  isMonthKey,
  isYearKey,
  monthHasAnything,
  wrappedIsOpen,
  monthlyCardLine,
  monthlyCardStats,
  monthlyFeature,
  monthlyHighlights,
  monthlyStory,
  monthLabel,
} from '@/lib/monthlyWrappedRules';
import { siteCard, wrappedCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite, showingAccounts } from '@/lib/ogKit';

export const dynamic = 'force-dynamic';

type Params = { rsn: string; month: string };

/** '2026-08-12' → '12 Aug'. */
function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * A character's month as a picture — what /p/<rsn>/wrapped/<month> unfurls into.
 *
 * Always the stranger's view (apexCharacter with no viewer): an unshared character draws the plain
 * Anvil card, the same as its profile card, so the link can't be used to ask whether it exists.
 */
async function load(_request: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const p = await params;
  const month = p.month;
  // Nothing until the period is over (a year: 1 December). The owner's preview is a page, not a card.
  if (!(isMonthKey(month) || isYearKey(month)) || !wrappedIsOpen(month)) return siteCard();
  const character = await apexCharacter(decodeURIComponent(p.rsn), null);
  if (!character) return siteCard();

  const year = isYearKey(month) ? await getYearlyWrapped(character.accountId, character.rsn, month) : null;
  const w = year ?? (await getMonthlyWrapped(character.accountId, character.rsn, month));
  if (!monthHasAnything(w)) return siteCard();

  const feature = monthlyFeature(w);
  const res = await wrappedCard({
    name: character.rsn,
    eventName: w.monthLabel,
    clanName: character.clan?.name ?? null,
    clanLogo: character.clan ? await ourImageAsDataUrl(character.clan.logoUrl, { width: 300, height: 300 }, 'png') : null,
    accent: null,
    line: (year?.trackedSince ? `${monthlyCardLine(w)} since ${shortDay(year.trackedSince)}` : monthlyCardLine(w)) || null,
    stats: year ? yearlyCardStats(year, monthlyCardStats(w)) : monthlyCardStats(w),
    feature: feature && { ...feature, sprite: await remoteSprite(feature.image, 150) },
    awards: year ? yearlyHighlights(year, monthlyHighlights(w)) : monthlyHighlights(w),
    luck: (year?.busiestMonth ? `Busiest month: ${monthLabel(year.busiestMonth.key).split(' ')[0]}` : null) ?? monthlyStory(w),
  });
  return showingAccounts(res, [character.accountId]);
}

export function GET(request: Request, ctx: { params: Promise<Params> }) {
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
