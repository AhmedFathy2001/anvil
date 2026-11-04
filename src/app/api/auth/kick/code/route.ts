import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { issueKickCode, kickCodeStatus, unlinkViewerKick, viewerKick } from '@/lib/gates/kickDb';
import { kickConfigured } from '@/lib/kick';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';

// A viewer's Kick link (lib/gates/kick): there is no viewer OAuth. The viewer asks for a one-time
// code here and types it in a connected host's Kick chat; the webhook links them.
//
//   GET                → { configured, username }        their linked Kick account, if any
//   GET ?code=ANVIL-…  → { state, … }                    how THEIR code went (polled by the page)
//   POST               → { code, expiresAt }             a fresh code (replaces an unused one)
//   DELETE             → unlink
const headers = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  const code = new URL(request.url).searchParams.get('code');
  if (code) return NextResponse.json(await kickCodeStatus(session.userId, code.toUpperCase().slice(0, 32)), { headers });
  const linked = await viewerKick(session.userId);
  return NextResponse.json({ configured: kickConfigured(), username: linked?.username ?? null }, { headers });
}

export async function POST() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  if (!kickConfigured()) return NextResponse.json({ error: 'Kick is not set up on this server.' }, { status: 503 });
  // Per login, not per IP: a code is bound to the login, and that is what an abuser would cycle.
  const rl = await rateLimitByKey('kick-code', String(session.userId), { limit: 8, windowMs: 60 * 60_000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many codes — try again later.' }, { status: 429, headers: rateLimitHeaders(rl) });
  }
  return NextResponse.json(await issueKickCode(session.userId), { headers });
}

export async function DELETE() {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  await unlinkViewerKick(session.userId);
  return NextResponse.json({ ok: true });
}
