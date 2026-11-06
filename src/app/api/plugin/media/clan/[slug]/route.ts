import { clanBoostLevel } from '@/lib/clanBoosts';
import { pluginPanelImage } from '@/lib/pluginPanelMedia';
import { visibleClan } from '@/lib/pluginUi/load';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clan = await visibleClan(request, slug);
  if (!clan?.bannerUrl) return new Response('Not found', { status: 404 });
  const requestedMotion = new URL(request.url).searchParams.get('motion') === '1';
  const level = (await clanBoostLevel(clan.id).catch(() => null))?.level ?? 0;
  return pluginPanelImage(clan.bannerUrl, 220, 73, requestedMotion && level >= 2);
}
