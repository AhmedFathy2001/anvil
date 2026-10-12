import { accountTypeLabel } from '@/lib/accountType';
import { apexCharacter } from '@/lib/apexProfiles';
import { comparePlayers } from '@/lib/compare';
import { headToHeadValue, headToHeadVerdict } from '@/lib/linkText';
import { headToHeadCard, siteCard } from '@/lib/ogCard';
import { cachedCard } from '@/lib/ogKit';
import { loadPlayerCard } from '@/lib/playerCard';

export const dynamic = 'force-dynamic';

/**
 * /compare's card: two characters facing off, every headline number with its leader lit.
 *
 * Asked as nobody, like /api/og/player — both characters must be shared, or it is the plain card.
 * Which of the two wasn't is deliberately not said, as on the page.
 */
async function load(_request: Request, { params }: { params: Promise<{ a: string; b: string }> }): Promise<Response> {
  const p = await params;
  const [a, b] = await Promise.all([apexCharacter(decodeURIComponent(p.a), null), apexCharacter(decodeURIComponent(p.b), null)]);
  if (!a || !b) return siteCard();

  const [cardA, cardB] = await Promise.all([loadPlayerCard(a), loadPlayerCard(b)]);
  const { headline } = comparePlayers(cardA, cardB);
  const sideLine = (type: string | null, clan: { name: string } | null) =>
    [accountTypeLabel(type), clan?.name ?? null].filter((x): x is string => !!x && x.toLowerCase() !== 'regular').join(' · ') || null;
  const leads = (s: 'a' | 'b') => headline.filter((r) => r.leader === s).length;

  return headToHeadCard({
    eyebrow: 'Head to head · Old School RuneScape',
    a: { name: cardA.rsn, line: sideLine(cardA.accountType, a.clan) },
    b: { name: cardB.rsn, line: sideLine(cardB.accountType, b.clan) },
    rows: headline.map((r) => ({ label: r.label, a: headToHeadValue(r.a, r.format), b: headToHeadValue(r.b, r.format), leader: r.leader })),
    verdict: headToHeadVerdict(cardA.rsn, cardB.rsn, headline),
    verdictSide: leads('a') === leads('b') ? null : leads('a') > leads('b') ? 'a' : 'b',
  });
}

export function GET(request: Request, ctx: { params: Promise<{ a: string; b: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
