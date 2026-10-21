// GET /img/item/<id> — RuneLite's cache sprite for one item id, served from our own cache.

import { assetResponse, getAsset, placeholderResponse } from '@/lib/assetCache';
import { parseItemId } from '@/lib/assetUrls';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const id = parseItemId((await params).id);
  if (id == null) return placeholderResponse(404);
  const asset = await getAsset({ kind: 'item', id });
  return asset ? assetResponse(asset) : placeholderResponse();
}
