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
    try {
      const data = JSON.parse(payload);
      const role = data.role;

      // Reject stale sessions (older than the 30-day cookie life) even with a valid signature, so a
      // replayed old token can't reach admin pages. The API layer additionally re-checks the live
      // role from the DB; this is the coarse page-routing gate.
      const iat = typeof data.iat === 'number' ? data.iat : 0;
      if (Date.now() - iat > 30 * 24 * 60 * 60 * 1000) {
        return NextResponse.redirect(loginUrl);
      }

      // Must be admin/treasurer/moderator/editor. Members get sent home.
      if (role !== 'admin' && role !== 'treasurer' && role !== 'moderator' && role !== 'editor') {
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Moderators (and treasurers, which extend moderator) can access dashboard, weekly,
      // clan, schedule, and verifications. Admin-only sections (events, players, staff,
      // integrations) redirect them home.
      if (role === 'moderator' || role === 'treasurer') {
        const allowed = [
          '/admin/dashboard',
          '/admin/weekly',
          '/admin/clan',
          '/admin/schedule',
          '/admin/verifications',
          '/admin/fees',
          '/admin/feedback',
        ];
        if (!allowed.some((p) => pathname.startsWith(p))) {
          return NextResponse.redirect(new URL('/admin/dashboard', request.url));
        }
      }

      // Editors author bingo tiles. Two flavours (distinguished by editorScope in the token):
      //  • GLOBAL editor (scope 'all'): moderator access PLUS tile authoring on every event.
      //  • BOARD-scoped editor (scope 'assigned'): NOT mod-tier — only the events list (filtered to
      //    their granted boards, server-side) and each granted board's Tiles tab. Everything else
      //    (dashboard, weekly, clan, schedule, verifications, feedback) bounces to the events list.
      if (role === 'editor') {
        const scoped = data.editorScope === 'assigned';
        // Global editors keep the moderator surfaces; scoped editors get NONE of them.
        const allowed = scoped
          ? []
          : [
              '/admin/dashboard',
              '/admin/weekly',
              '/admin/clan',
              '/admin/schedule',
              '/admin/verifications',
              '/admin/feedback',
            ];
        const canEvents = pathname.startsWith('/admin/events') && pathname !== '/admin/events/new';
        if (!canEvents && !allowed.some((p) => pathname.startsWith(p))) {
          // Scoped editors have no dashboard — send them to their events list instead.
          return NextResponse.redirect(new URL(scoped ? '/admin/events' : '/admin/dashboard', request.url));
        }
        const eventPage = pathname.match(/^\/admin\/events\/(\d+)(\/.*)?$/);
        if (eventPage && eventPage[2] !== '/tiles' && !(eventPage[2] ?? '').startsWith('/tiles/')) {
          return NextResponse.redirect(new URL(`/admin/events/${eventPage[1]}/tiles`, request.url));
        }
      }
    } catch {
      return NextResponse.redirect(loginUrl);
    }
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
