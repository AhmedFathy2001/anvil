import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireSecret } from '@/lib/env';

const ADMIN_SESSION_SECRET = requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret');
const CAPTAIN_SESSION_SECRET = requireSecret('CAPTAIN_SESSION_SECRET', 'dev-captain-secret');
const PLAYER_SESSION_SECRET = requireSecret('PLAYER_SESSION_SECRET', 'dev-player-secret');

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return bytesToHex(new Uint8Array(sig));
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyToken(token: string, secret: string): Promise<string | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  let payload: string;
  try {
    payload = atob(encodedPayload);
  } catch {
    return null;
  }
  const expectedSignature = await hmacSign(payload, secret);
  if (!constantTimeEqual(signature, expectedSignature)) {
    return null;
  }
  return payload;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect admin routes — all auth flows through Discord OAuth at /login now.
  if (pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('return', pathname);
    const token = request.cookies.get('admin_session')?.value;
    if (!token) {
      return NextResponse.redirect(loginUrl);
    }
    const payload = await verifyToken(token, ADMIN_SESSION_SECRET);
    if (!payload) {
      return NextResponse.redirect(loginUrl);
    }
    // Freshness is the last thing this layer can honestly judge. Reject a session older than the
    // cookie's life even with a valid signature, so a replayed token cannot reach admin pages.
    try {
      const data = JSON.parse(payload);
      const iat = typeof data.iat === 'number' ? data.iat : 0;
      if (Date.now() - iat > 30 * 24 * 60 * 60 * 1000) {
        return NextResponse.redirect(loginUrl);
      }
    } catch {
      return NextResponse.redirect(loginUrl);
    }

    // AND NOTHING ELSE. Ninety lines of role-based routing used to live here, decided from the role
    // baked into the token. With one deployment serving many clans that claim is meaningless — a
    // cookie minted on one clan's host says `admin` on every other — and middleware runs at the edge
    // with no database to check it against. The routing moved to the admin layout, which resolves
    // the grant for the clan actually being looked at (lib/adminAccess).
  }

  // Protect captain routes (except the login page itself)
  if (pathname.startsWith('/captain') && pathname !== '/captain') {
    const token = request.cookies.get('captain_session')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/captain', request.url));
    }
    const payload = await verifyToken(token, CAPTAIN_SESSION_SECRET);
    if (!payload) {
      return NextResponse.redirect(new URL('/captain', request.url));
    }
    try {
      const data = JSON.parse(payload);
      if (data.role !== 'captain' || typeof data.teamId !== 'number') {
        return NextResponse.redirect(new URL('/captain', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/captain', request.url));
    }
  }

  // Protect player dashboard (except login page and direct link)
  if (pathname === '/player/dashboard') {
    const token = request.cookies.get('player_session')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/player', request.url));
    }
    const payload = await verifyToken(token, PLAYER_SESSION_SECRET);
    if (!payload) {
      return NextResponse.redirect(new URL('/player', request.url));
    }
    try {
      const data = JSON.parse(payload);
      if (data.role !== 'player' || typeof data.playerId !== 'number') {
        return NextResponse.redirect(new URL('/player', request.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/player', request.url));
    }
  }

  // Unified "My Team" surface — open to any logged-in Discord user; the page itself
  // resolves captain/player membership per team.
  if (pathname.startsWith('/team')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('return', pathname);
    const token = request.cookies.get('admin_session')?.value;
    if (!token) {
      return NextResponse.redirect(loginUrl);
    }
    const payload = await verifyToken(token, ADMIN_SESSION_SECRET);
    if (!payload) {
      return NextResponse.redirect(loginUrl);
    }
  }

  // Forward the pathname to server components so layouts/pages can make path-aware decisions the
  // token alone can't drive — e.g. the admin shell redirects a board-scoped editor (live editorScope
  // read from the DB) off any non-/admin/events page, even when their session token predates the
  // editorScope field. Middleware here is only the coarse gate.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-anvil-pathname', pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/admin/:path*', '/captain/:path*', '/player/dashboard', '/team/:path*'],
};
