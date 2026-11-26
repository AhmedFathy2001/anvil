import { gunzipSync } from 'node:zlib';

import { NextResponse } from 'next/server';

import { flairFull } from '@/lib/chatFlairFeed';
import { log } from '@/lib/logger';

// GET /api/plugin/chat-flair/v/<v> — capability 'chat-flair-v'. The whole Supporter name list AT
// version v, compact (lib/chatFlairWire: {v, styles, names, ix}) and pre-gzipped once per version.
// A version never changes, so it is cached for a year (Cloudflare holds it: one origin hit per
// version, however many plugins download it). Anything but the current version is a 404 the plugin
// answers by asking ./v again.

export const dynamic = 'force-dynamic';

export async function GET(request: Request, ctx: { params: Promise<{ v: string }> }) {
  const { v } = await ctx.params;
  let full;
  try {
    full = await flairFull();
  } catch (err) {
    log.warn('chat-flair.full-failed', { err: String(err) });
    return NextResponse.json({ error: 'Unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!/^\d{1,9}$/.test(v) || Number(v) !== full.v) {
    return NextResponse.json({ error: 'Not current', v: full.v }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=31536000, immutable',
    ETag: `"flair-${full.v}"`,
    Vary: 'Accept-Encoding',
  };
  if (request.headers.get('if-none-match') === headers.ETag) return new NextResponse(null, { status: 304, headers });
  // Plain JSON only. Serving the pre-gzipped bytes with Content-Encoding: gzip got compressed a
  // second time on the way out (the proxy in front of the app), and a client without
  // Accept-Encoding got gzip bytes with no header at all: either way the plugin read garbage, so a
  // fresh list (a new install, a new site) never loaded. The proxy compresses this itself.
  return new NextResponse(full.json ?? gunzipSync(full.gz).toString(), { headers });
}
