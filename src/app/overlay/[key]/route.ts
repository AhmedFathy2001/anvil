import crypto from 'node:crypto';

import { overlayCsp, overlayHtml } from '@/lib/overlay/overlayPage';
import { isOverlayKey, parseOverlayOptions } from '@/lib/overlay/overlayView';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * The stream overlay page — what a streamer pastes into OBS as a Browser source.
 *
 *   /overlay/<key>?view=standings|feed|board&size=s|m|l|xl&scale=0.5–3&limit=1–20&title=0&accent=hex&align=right
 *
 * A route handler, not a page: it sits outside the root layout, so no nav, no footer, a transparent
 * body (lib/overlay/overlayPage). The page carries no data — an unknown key gets the same document
 * and finds out from its first poll — so this answer says nothing about which keys exist. Its own
 * security headers (next.config skips /overlay): a strict CSP, no referrer (the key is in the path).
 */
export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const rl = await rateLimit(request, 'overlay-page', { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return new Response('Too many requests', { status: 429 });
  if (!isOverlayKey(key)) return new Response('Not found', { status: 404 });
  const opts = parseOverlayOptions(new URL(request.url).searchParams);
  const nonce = crypto.randomBytes(16).toString('base64');
  return new Response(overlayHtml(key, opts, nonce), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': overlayCsp(nonce),
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
