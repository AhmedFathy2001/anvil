// GET /img/mode/<key>/item/<id>.png | /img/mode/<key>/wiki/<file> — a post's thumbnail with a game
// mode's icon badged on its corner (lib/worldModes markMode), served from our own cache.
// The path names a catalogued mode key and one of our own assets, validated exactly as /img/item and
// /img/wiki validate theirs; the badge is the mode's catalogued icon. No query is accepted.

import type { NextRequest } from 'next/server';

import { getModeBadgedAsset, assetResponse, limitedResponse, missThrottle, placeholderResponse } from '@/lib/assetCache';
import { modeBadgeFile, parseModeBadgePath } from '@/lib/worldModes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  // The RAW path, so a wiki name is decoded exactly once (as /img/wiki does).
  const { pathname, search } = request.nextUrl;
  if (search) return placeholderResponse(400);
  const parsed = parseModeBadgePath(pathname);
  const badge = parsed ? modeBadgeFile(parsed.key) : null;
  if (!parsed || !badge) return placeholderResponse(404);
  const asset = await getModeBadgedAsset(parsed.key, badge, parsed.ref, { allowMiss: missThrottle(request) });
  if (asset === 'limited') return limitedResponse();
  return asset ? assetResponse(asset) : placeholderResponse();
}
