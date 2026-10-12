import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { apexClan } from '@/lib/apexProfiles';
import { loadClanCard } from '@/lib/clanCard';
import { compareClans } from '@/lib/compare';
import { ourImageAsDataUrl } from '@/lib/crestImage';
import { headToHeadValue, headToHeadVerdict, plural } from '@/lib/linkText';
import { headToHeadCard, siteCard } from '@/lib/ogCard';
import { cachedCard } from '@/lib/ogKit';

export const dynamic = 'force-dynamic';

/** A clan, through the same gate /compare/clans uses: `apexClan` (public AND listed), then its logo. */
async function resolveClan(slug: string) {
  const listed = await apexClan(slug.toLowerCase());
  if (!listed) return null;
  // clan-scope: global -- the logo of a clan apexClan has just resolved and gated by slug.
  const row = await db.query.clans.findFirst({ where: eq(clans.id, listed.id), columns: { logoUrl: true } });
  return { id: listed.id, slug: listed.slug, name: listed.name, logoUrl: row?.logoUrl ?? null };
}

/** /compare/clans's card: two crests facing off, the clan numbers with each leader lit. */
async function load(_request: Request, { params }: { params: Promise<{ a: string; b: string }> }): Promise<Response> {
  const p = await params;
  const [a, b] = await Promise.all([resolveClan(decodeURIComponent(p.a)), resolveClan(decodeURIComponent(p.b))]);
  if (!a || !b) return siteCard();

  const [cardA, cardB, logoA, logoB] = await Promise.all([
    loadClanCard(a),
    loadClanCard(b),
    ourImageAsDataUrl(a.logoUrl, { width: 200, height: 200 }, 'png'),
    ourImageAsDataUrl(b.logoUrl, { width: 200, height: 200 }, 'png'),
  ]);
  const { headline } = compareClans(cardA, cardB);
  const leads = (s: 'a' | 'b') => headline.filter((r) => r.leader === s).length;

  return headToHeadCard({
    eyebrow: 'Clan vs clan · Old School RuneScape',
    a: { name: a.name, line: plural(cardA.members, 'member'), face: { logo: logoA } },
    b: { name: b.name, line: plural(cardB.members, 'member'), face: { logo: logoB } },
    rows: headline.map((r) => ({ label: r.label, a: headToHeadValue(r.a, r.format), b: headToHeadValue(r.b, r.format), leader: r.leader })),
    verdict: headToHeadVerdict(a.name, b.name, headline),
    verdictSide: leads('a') === leads('b') ? null : leads('a') > leads('b') ? 'a' : 'b',
  });
}

export function GET(request: Request, ctx: { params: Promise<{ a: string; b: string }> }) {
  // Keyed by path alone: the card never depends on who is asking.
  return cachedCard(new URL(request.url).pathname, () => load(request, ctx));
}
