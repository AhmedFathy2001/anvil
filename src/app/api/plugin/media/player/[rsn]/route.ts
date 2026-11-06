import { apexCharacter } from '@/lib/apexProfiles';
import { profileMediaForPlayer } from '@/lib/profileMedia';
import { pluginPanelImage } from '@/lib/pluginPanelMedia';
import { viewerPlayerId } from '@/lib/pluginUi/load';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ rsn: string }> }) {
  const { rsn } = await params;
  const character = await apexCharacter(decodeURIComponent(rsn), await viewerPlayerId(request));
  if (!character?.personId || (!character.personPublic && !character.viewerOwns)) return new Response('Not found', { status: 404 });
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind') === 'avatar' ? 'avatar' : 'banner';
  const requestedMotion = query.get('motion') === '1';
  const media = await profileMediaForPlayer(character.personId, { still: !requestedMotion });
  const image = media[kind];
  if (!image) return new Response('Not found', { status: 404 });
  return pluginPanelImage(image.src, kind === 'avatar' ? 48 : 220, kind === 'avatar' ? 48 : 73, requestedMotion && image.animated);
}
