import { accountTypeLabel } from '@/lib/accountType';
import { resolveClanBySlug } from '@/lib/clanContext';
import { clanVisibilityOf } from '@/lib/clanVisibility';
import { SKILLS } from '@/lib/constants';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { compact } from '@/lib/linkText';
import { getMemberProfile } from '@/lib/memberProfile';
import { momentsForMembers } from '@/lib/momentsStore';
import { memberCard, siteCard } from '@/lib/ogCard';
import { cachedCard, remoteSprite } from '@/lib/ogKit';
import { getClanDisplayName } from '@/lib/pluginConfig';
import { bossItemForStatKey, itemIconUrl, wikiImageUrl } from '@/lib/tileIcons';

export const dynamic = 'force-dynamic';

const MAX_TOTAL_LEVEL = (SKILLS.length - 1) * 99;

/**
 * A member's card, as their clan sees them: name, the clan, the four numbers people compare, and
 * the loot they've been getting.
 *
 * Only what the member page already shows anybody — hiscores numbers, the in-game rank, and drops
 * the clan's feed recorded. Never the persona (the Discord identity and the alts), which the page
 * itself keeps behind sign-in. A clan that keeps to itself, or an RSN that isn't on its roster, gets
 * the plain Anvil card rather than a 404 that would answer "is this person in that clan?".
 */
async function load(_request: Request, { params }: { params: Promise<{ slug: string; rsn: string }> }): Promise<Response> {
  const { slug, rsn } = await params;
  const clan = await resolveClanBySlug(slug);
  if (!clan || clanVisibilityOf(clan.visibility) !== 'public') return siteCard();

  const profile = await getMemberProfile(clan.id, decodeURIComponent(rsn));
  if (!profile || profile.leftAt) return siteCard();

  const [clanName, moments, clanLogo] = await Promise.all([
    getClanDisplayName(clan.id, clan.name),
    // Keyed by the SEAT: a moment is stamped with the seat it happened under.
    momentsForMembers([profile.id], 30).catch(() => []),
    ourImageAsDataUrl(clan.logoUrl, { width: 260, height: 260 }, 'png'),
  ]);

  // The art: their recent drops, one sprite per item, then — for a quiet account — the signature
  // drop of the bosses they've killed most, so a maxed main with no plugin still has a face.
  const itemIds: number[] = [];
  for (const m of moments) {
    if (m.itemId != null && m.kind !== 'death' && !itemIds.includes(m.itemId)) itemIds.push(m.itemId);
    if (itemIds.length >= 9) break;
  }
  for (const b of [...profile.bosses].sort((a, b) => b.kc - a.kc)) {
    if (itemIds.length >= 9 || b.kc <= 0) break;
    const id = bossItemForStatKey(b.key);
    if (id != null && !itemIds.includes(id)) itemIds.push(id);
  }

  const [loot, totalIcon, combatIcon] = await Promise.all([
    Promise.all(itemIds.map((id) => remoteSprite(itemIconUrl(id), 76))),
    remoteSprite(wikiImageUrl('Stats_icon.png'), 24),
    remoteSprite(wikiImageUrl('Combat_icon.png'), 24),
  ]);

  const line = [
    accountTypeLabel(profile.accountType),
    profile.totalLevel >= MAX_TOTAL_LEVEL ? 'Maxed' : null,
    profile.isGuest ? 'Guest' : profile.rank,
  ]
    .filter((x): x is string => !!x && x.toLowerCase() !== 'regular')
    .join(' · ');

  const eff = profile.efficiency;
  const stats = [
    profile.totalLevel > 0 ? { value: profile.totalLevel.toLocaleString('en-US'), label: 'Total', icon: totalIcon } : null,
    profile.combatLevel ? { value: String(profile.combatLevel), label: 'Combat', icon: combatIcon } : null,
    eff && eff.ehp > 0 ? { value: compact(Math.round(eff.ehp)), label: 'EHP', icon: null } : null,
    eff && eff.ehb > 0 ? { value: compact(Math.round(eff.ehb)), label: 'EHB', icon: null } : null,
  ].filter((s): s is NonNullable<typeof s> => s !== null);

  return memberCard({
    rsn: profile.rsn,
    clanName: clanName || clan.name,
    clanLogo,
    line: line || null,
    stats,
    loot,
  });
}

export function GET(request: Request, ctx: { params: Promise<{ slug: string; rsn: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
