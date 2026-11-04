import { overlayEventForKey, overlayMark, overlaySnapshot } from '@/lib/overlay/overlayData';
import { etagMatches, isOverlayKey, overlayEtag, parseOverlayOptions } from '@/lib/overlay/overlayView';
import { rateLimit, rateLimitByKey } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const HEADERS = {
  // Revalidate every time (the page sends If-None-Match itself); never stored by a shared cache.
  'Cache-Control': 'private, no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
};

/**
 * The stream overlay's data: one view of the event an overlay key opens, as the signed-out public
 * would see it (lib/overlay/overlayView — the curtain, the reveal and missions all apply).
 *
 * Polled every ~10 s by the overlay page. Cheap by construction: a malformed key never reaches the
 * database, the snapshot is memoised per event+view for a few seconds, and an unchanged payload is a
 * 304 with no body. Rate-limited per IP and per key, generously enough for a scene with every view.
 * An unknown, reset or removed key is a plain 404 — the same answer whatever the reason.
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ip = await rateLimit(request, 'overlay-data', { limit: 120, windowMs: 60_000 });
  if (!ip.ok) return Response.json({ error: 'Too many requests' }, { status: 429, headers: HEADERS });
  if (!isOverlayKey(key)) return Response.json({ error: 'Not found' }, { status: 404, headers: HEADERS });
  const perKey = await rateLimitByKey('overlay-data-key', key, { limit: 240, windowMs: 60_000 });
  if (!perKey.ok) return Response.json({ error: 'Too many requests' }, { status: 429, headers: HEADERS });

  const event = await overlayEventForKey(key);
  if (!event) return Response.json({ error: 'Not found' }, { status: 404, headers: HEADERS });

  const opts = parseOverlayOptions(new URL(request.url).searchParams);
  const [snapshot, mark] = await Promise.all([overlaySnapshot(event, opts), overlayMark(event.clanId)]);
  const json = JSON.stringify(mark ? { ...snapshot, mark: true } : snapshot);
  const etag = overlayEtag(json);
  if (etagMatches(request.headers.get('if-none-match'), etag)) {
    return new Response(null, { status: 304, headers: { ...HEADERS, ETag: etag } });
  }
  return new Response(json, { headers: { ...HEADERS, 'Content-Type': 'application/json', ETag: etag } });
}
