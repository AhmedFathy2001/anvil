import { apexCharacter } from '@/lib/apexProfiles';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { getMonthlyWrapped } from '@/lib/monthlyWrapped';
import {
  isMonthKey,
  monthHasAnything,
  monthKeyOf,
  monthlyCardLine,
  monthlyCardStats,
  monthlyFeature,
  monthlyHighlights,
  monthlyStory,
} from '@/lib/monthlyWrappedRules';
import { siteCard, wrappedCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite, showingAccounts } from '@/lib/ogKit';

export const dynamic = 'force-dynamic';

type Params = { rsn: string; month: string };

/**
 * A character's month as a picture — what /p/<rsn>/wrapped/<month> unfurls into.
 *
 * Always the stranger's view (apexCharacter with no viewer): an unshared character draws the plain
 * Anvil card, the same as its profile card, so the link can't be used to ask whether it exists.
 */
async function load(_request: Request, { params }: { params: Promise<Params> }): Promise<Response> {
  const p = await params;
  const month = p.month;
  if (!isMonthKey(month) || month > monthKeyOf(new Date())) return siteCard();
  const character = await apexCharacter(decodeURIComponent(p.rsn), null);
  if (!character) return siteCard();

  const w = await getMonthlyWrapped(character.accountId, character.rsn, month);
  if (!monthHasAnything(w)) return siteCard();

  const feature = monthlyFeature(w);
  const res = await wrappedCard({
    name: character.rsn,
    eventName: w.inProgress ? `${w.monthLabel} so far` : w.monthLabel,
    clanName: character.clan?.name ?? null,
    clanLogo: character.clan ? await ourImageAsDataUrl(character.clan.logoUrl, { width: 300, height: 300 }, 'png') : null,
    accent: null,
    line: monthlyCardLine(w) || null,
    stats: monthlyCardStats(w),
    feature: feature && { ...feature, sprite: await remoteSprite(feature.image, 150) },
    awards: monthlyHighlights(w),
    luck: monthlyStory(w),
  });
  return showingAccounts(res, [character.accountId]);
}

export function GET(request: Request, ctx: { params: Promise<Params> }) {
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
