import { apexCharacter } from '@/lib/apexProfiles';
import { profileMediaForPlayer } from '@/lib/profileMedia';
import { pluginPanelImage } from '@/lib/pluginPanelMedia';
import { panelDiscordAvatar, viewerPlayerId } from '@/lib/pluginUi/load';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ rsn: string }> }) {
  const { rsn } = await params;
  const character = await apexCharacter(decodeURIComponent(rsn), await viewerPlayerId(request));
  if (!character?.personId || !character.personMedia) return new Response('Not found', { status: 404 });
  const query = new URL(request.url).searchParams;
  const kind = query.get('kind') === 'avatar' ? 'avatar' : 'banner';
  const requested = (key: string, fallback: number, max: number) => {
    const n = Number(query.get(key));
    return Number.isInteger(n) && n >= 12 && n <= max ? n : fallback;
  };
  const width = requested('w', kind === 'avatar' ? 48 : 220, kind === 'avatar' ? 48 : 220);
  const height = requested('h', kind === 'avatar' ? 48 : 73, kind === 'avatar' ? 48 : 73);
  const requestedMotion = query.get('motion') === '1';
  const media = await profileMediaForPlayer(character.personId, { still: !requestedMotion });
  const image = media[kind];
  if (image) {
    return pluginPanelImage(image.src, width, height, requestedMotion && image.animated, kind === 'banner' && 'position' in image ? image.position : null);
  }
  // The Discord picture fallback says who the person is: only where they link characters publicly.
  if (kind === 'avatar' && (character.personPublic || character.viewerOwns)) {
    const discord = await panelDiscordAvatar(character.personId);
    if (discord) return pluginPanelImage(discord.src, width, height, requestedMotion && discord.animated);
  }
  return new Response('Not found', { status: 404 });
}
