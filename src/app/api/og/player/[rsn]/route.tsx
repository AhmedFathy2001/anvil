import { accountTypeLabel } from '@/lib/accountType';
import { apexCharacter } from '@/lib/apexProfiles';
import { resolveClanBySlug } from '@/lib/clanContext';
import { SKILLS } from '@/lib/constants';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { compact } from '@/lib/linkText';
import { memberCard, siteCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite } from '@/lib/ogKit';
import { loadPlayerCard } from '@/lib/playerCard';
import { bossItemForStatKey, itemIconUrl } from '@/lib/tileIcons';

export const dynamic = 'force-dynamic';

const MAX_TOTAL_LEVEL = (SKILLS.length - 1) * 99;
const WIKI = 'https://oldschool.runescape.wiki/images';

/**
 * A character's card, for /p/<rsn>: the member card's layout, told from the character's side.
 *
 * Asked as NOBODY. `apexCharacter` with no viewer is the stranger's answer — a character its owner
 * hasn't shared gets the plain Anvil card, even when the owner is the one pasting the link, because
 * the picture is cached and fetched by Discord for everybody in the channel.
 */
async function load(_request: Request, { params }: { params: Promise<{ rsn: string }> }): Promise<Response> {
  const c = await apexCharacter(decodeURIComponent((await params).rsn), null);
  if (!c) return siteCard();

  const [card, clan] = await Promise.all([loadPlayerCard(c), c.clan ? resolveClanBySlug(c.clan.slug) : Promise.resolve(null)]);

  // Their latest log slots first, then the signature drop of the bosses they've killed most.
  const itemIds: number[] = [];
  for (const l of card.latest) if (l.itemId != null && !itemIds.includes(l.itemId)) itemIds.push(l.itemId);
  for (const b of card.bosses) {
    if (itemIds.length >= 9) break;
    const id = bossItemForStatKey(b.key);
    if (id != null && !itemIds.includes(id)) itemIds.push(id);
  }

  const [loot, totalIcon, combatIcon, clanLogo] = await Promise.all([
    Promise.all(itemIds.slice(0, 9).map((id) => remoteSprite(itemIconUrl(id), 76))),
    remoteSprite(`${WIKI}/Stats_icon.png`, 24),
    remoteSprite(`${WIKI}/Combat_icon.png`, 24),
    clan ? ourImageAsDataUrl(clan.logoUrl, { width: 260, height: 260 }, 'png') : Promise.resolve(null),
  ]);

  const line = [accountTypeLabel(card.accountType), card.totalLevel >= MAX_TOTAL_LEVEL ? 'Maxed' : null]
    .filter((x): x is string => !!x && x.toLowerCase() !== 'regular')
    .join(' · ');

  const stats = [
    card.totalLevel > 0 ? { value: card.totalLevel.toLocaleString('en-US'), label: 'Total', icon: totalIcon } : null,
    card.combatLevel ? { value: String(card.combatLevel), label: 'Combat', icon: combatIcon } : null,
    card.ehp && card.ehp > 0 ? { value: compact(Math.round(card.ehp)), label: 'EHP', icon: null } : null,
    card.ehb && card.ehb > 0 ? { value: compact(Math.round(card.ehb)), label: 'EHB', icon: null } : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return memberCard({
    rsn: card.rsn,
    clanName: c.clan?.name ?? null,
    clanLogo,
    eyebrow: c.clan ? `OSRS · ${c.clan.name.slice(0, 26)}` : 'Old School RuneScape',
    line: line || null,
    stats,
    loot,
  });
}

export function GET(request: Request, ctx: { params: Promise<{ rsn: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
