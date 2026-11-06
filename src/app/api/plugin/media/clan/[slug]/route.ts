import { clanBoostLevel } from '@/lib/clanBoosts';
import { pluginPanelImage } from '@/lib/pluginPanelMedia';
import { visibleClan } from '@/lib/pluginUi/load';
import { isCreatorSpace } from '@/lib/creatorSpaces';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clan = await visibleClan(request, slug);
  if (!clan) return new Response('Not found', { status: 404 });
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind') === 'logo' ? 'logo' : 'banner';
  const source = kind === 'logo' ? clan.logoUrl : clan.bannerUrl;
  if (!source) return new Response('Not found', { status: 404 });
  const requestedMotion = query.get('motion') === '1';
  const level = (await clanBoostLevel(clan.id).catch(() => null))?.level ?? 0;
  const motion = requestedMotion && (kind === 'logo' || level >= 2 || isCreatorSpace(clan));
  return pluginPanelImage(source, kind === 'logo' ? 36 : 220, kind === 'logo' ? 36 : 73, motion, kind === 'banner');
}
