// GET /img/wiki/<file> — an OSRS wiki `/images/<file>` image, served from our own cache.
// Only wiki image files (see normalizeWikiFile); nothing else is reachable through here.

import type { NextRequest } from 'next/server';

import { assetResponse, getScaledAsset, limitedResponse, missThrottle, placeholderResponse } from '@/lib/assetCache';
import { parseAssetPath, parseWikiScale, WIKI_ASSET_PREFIX } from '@/lib/assetUrls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  // Read the RAW path rather than the decoded params, so a name is decoded exactly once.
  // The query is ignored but for `x` (a pixel-perfect upscale, WIKI_SCALES only — anything else is a
  // 400): the wiki's cache-buster is looked up server-side (lib/assetUrls).
  const { pathname, searchParams } = request.nextUrl;
  const ref = pathname.startsWith(WIKI_ASSET_PREFIX) ? parseAssetPath(pathname) : null;
  if (!ref || ref.kind !== 'wiki') return placeholderResponse(404);
  const xs = searchParams.getAll('x');
  const scale = xs.length > 1 ? null : parseWikiScale(xs[0]);
  if (scale == null) return placeholderResponse(400);
  const asset = await getScaledAsset(ref, scale, { allowMiss: missThrottle(request) });
  if (asset === 'limited') return limitedResponse();
  return asset ? assetResponse(asset) : placeholderResponse();
}
