// GET /img/item/<id>.png — RuneLite's cache sprite for one item id, served from our own cache.
// The bare /img/item/<id> (the old spelling, still in stored URLs and old Discord posts) is the same
// handler: parseItemId takes either. `?x=2|3|4` is a pixel-perfect upscale (scaledAssetResponse).

import { placeholderResponse, scaledAssetResponse } from '@/lib/assetCache';
import { parseItemId } from '@/lib/assetUrls';

export const runtime = 'nodejs';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = parseItemId((await params).id);
  if (id == null) return placeholderResponse(404);
  return scaledAssetResponse(request, { kind: 'item', id });
}
