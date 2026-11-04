import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import sharp from 'sharp';

import { db } from '@/db';
import { submissions } from '@/db/schema';
import { THUMB_H, THUMB_W, proofImageSigOk } from '@/lib/proofImage';
import { isManagedMediaUrl } from '@/lib/storage';

/**
 * One proof's picture for the plugin's side panel (lib/proofImage has the links).
 *
 * `?t=1&s=…` — a THUMB_W×THUMB_H JPEG (a few KB) made from the stored image once and kept: in
 * memory here (a small LRU) and for a year by whoever caches the response, since a changed picture
 * is a changed link. Without `t` — a redirect to the full image on the media host, for "open it in
 * the browser". Only our own media host is ever fetched or redirected to.
 */

export const dynamic = 'force-dynamic';

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_MAX = 400;

/** Thumbnails by signed link, oldest first; a hit moves to the back. ~5 KB each. */
const cache = new Map<string, Buffer>();
/** Thumbnails being made, so a burst of the same row makes one. */
const making = new Map<string, Promise<Buffer | null>>();

function remember(key: string, thumb: Buffer) {
  cache.delete(key);
  cache.set(key, thumb);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value!);
}

async function makeThumb(imageUrl: string): Promise<Buffer | null> {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(() => null);
  if (!res?.ok || !res.body) return null;
  if (Number(res.headers.get('content-length') ?? 0) > MAX_SOURCE_BYTES) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  try {
    return await sharp(Buffer.concat(chunks))
      .rotate()
      .resize({ width: THUMB_W, height: THUMB_H, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#1e1e1e' })
      .jpeg({ quality: 72 })
      .toBuffer();
  } catch {
    return null;
  }
}

const gone = () => new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return gone();
  const q = new URL(request.url).searchParams;
  const sig = q.get('s');
  // clan-scope: global -- the signed link names one submission; the signature is the permission.
  const row = await db.query.submissions.findFirst({ where: eq(submissions.id, id), columns: { imageUrl: true } });
  const imageUrl = row?.imageUrl ?? '';
  if (!imageUrl || !isManagedMediaUrl(imageUrl) || !proofImageSigOk(id, imageUrl, sig)) return gone();

  if (q.get('t') !== '1') {
    return NextResponse.redirect(imageUrl, { status: 302, headers: { 'Cache-Control': 'private, max-age=300' } });
  }

  const key = `${id}:${sig}`;
  let thumb = cache.get(key) ?? null;
  if (thumb) remember(key, thumb);
  else {
    let pending = making.get(key);
    if (!pending) {
      pending = makeThumb(imageUrl).finally(() => making.delete(key));
      making.set(key, pending);
    }
    thumb = await pending;
    if (!thumb) return gone();
    remember(key, thumb);
  }
  return new NextResponse(new Uint8Array(thumb), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Length': String(thumb.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
