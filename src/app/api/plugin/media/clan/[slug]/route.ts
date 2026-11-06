import { clanBoostLevel } from '@/lib/clanBoosts';
import { pluginPanelImage } from '@/lib/pluginPanelMedia';
import { visibleClan } from '@/lib/pluginUi/load';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const clan = await visibleClan(request, slug);
  if (!clan) return new Response('Not found', { status: 404 });
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind') === 'logo' ? 'logo' : 'banner';
  const requested = (key: string, fallback: number, max: number) => {
    const n = Number(query.get(key));
    return Number.isInteger(n) && n >= 12 && n <= max ? n : fallback;
  };
  const width = requested('w', kind === 'logo' ? 36 : 220, kind === 'logo' ? 36 : 220);
  const height = requested('h', kind === 'logo' ? 36 : 73, kind === 'logo' ? 36 : 73);
  const source = kind === 'logo' ? clan.logoUrl : clan.bannerUrl;
  if (!source) return new Response('Not found', { status: 404 });
  const requestedMotion = query.get('motion') === '1';
  const level = (await clanBoostLevel(clan.id).catch(() => null))?.level ?? 0;
  // Match Discord: uploaded art may exist at every level, but animation is a Level 2+ perk for
  // both the wide banner and the clan mark. Below that, pluginPanelImage returns its first frame.
  const motion = requestedMotion && level >= 2;
  return pluginPanelImage(source, width, height, motion, kind === 'banner');
}
