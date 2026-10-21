// GET /img/wiki/<file> — an OSRS wiki `/images/<file>` image, served from our own cache.
// Only wiki image files (see normalizeWikiFile); nothing else is reachable through here.

import type { NextRequest } from 'next/server';

import { assetResponse, getAsset, limitedResponse, missThrottle, placeholderResponse } from '@/lib/assetCache';
import { parseAssetPath, WIKI_ASSET_PREFIX } from '@/lib/assetUrls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<Response> {
  // Read the RAW path rather than the decoded params, so a name is decoded exactly once.
  // Any query is ignored: the wiki's cache-buster is looked up server-side (lib/assetUrls).
  const { pathname } = request.nextUrl;
  const ref = pathname.startsWith(WIKI_ASSET_PREFIX) ? parseAssetPath(pathname) : null;
  if (!ref || ref.kind !== 'wiki') return placeholderResponse(404);
  const asset = await getAsset(ref, { allowMiss: missThrottle(request) });
  if (asset === 'limited') return limitedResponse();
  return asset ? assetResponse(asset) : placeholderResponse();
}
