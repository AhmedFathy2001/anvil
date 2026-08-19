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

  // ── Clans are addressed by PATH ────────────────────────────────────────────────────────────
  //
  // `/c/<slug>/anything` is the canonical address of a clan's pages. The clan used to come from the
  // Host, which made every clan a separate site you had to travel to; the point of one platform is
  // that they sit together, so browsing from the directory into a clan and back out never changes
  // hostname.
  //
  // The file tree is untouched. This rewrites the URL back to the route that already exists and
  // hands the slug along in a header, which lib/clanContext reads in preference to the Host. A
  // route group under app/c/[slug] would have meant physically moving thirty page directories and
  // re-addressing every API route with them, for the same result.
  //
  // API calls carry the prefix too — `/c/<slug>/api/...` — so a request is self-describing about
  // which clan it is for, rather than depending on a header the caller might forget to send.
  const clanPath = /^\/c\/([a-z0-9-]{2,32})(\/.*)?$/.exec(pathname);
  if (clanPath) {
    const [, slug, rest] = clanPath;
    const url = request.nextUrl.clone();
    url.pathname = rest && rest !== '/' ? rest : '/';
    const headers = new Headers(request.headers);
    headers.set('x-anvil-clan-slug', slug);
    // The prefix, so anything building a link back out can reproduce it without re-parsing.
    headers.set('x-anvil-clan-prefix', `/c/${slug}`);
    headers.set('x-anvil-pathname', url.pathname);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // ── The old per-clan hostname ──────────────────────────────────────────────────────────────
  //
  // Every installed plugin has `<slug>.anvilosrs.com` stored in it, and a hub release is slow, so
  // /api keeps answering there forever. Pages move: a 301 sends people to the one canonical address
  // instead of leaving two that drift.
  const host = (request.headers.get('host') ?? '').toLowerCase().split(':')[0];
  const apex = (process.env.ANVIL_APEX_DOMAIN || 'anvilosrs.com').toLowerCase();
  if (
    host.endsWith(`.${apex}`) &&
    host !== apex &&
    host !== `www.${apex}` &&
    !pathname.startsWith('/api/') &&
    // Next's own assets resolve relative to whatever host served the page; redirecting them would
    // break the very page doing the redirecting.
    !pathname.startsWith('/_next/')
  ) {
    const slug = host.slice(0, -(apex.length + 1));
    if (/^[a-z0-9-]{2,32}$/.test(slug) && !slug.includes('.')) {
      const to = request.nextUrl.clone();
      to.host = apex;
      to.pathname = `/c/${slug}${pathname === '/' ? '' : pathname}`;
      return NextResponse.redirect(to, 301);
    }
  }


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
  // Everything except Next's own assets and the files it serves verbatim. The clan prefix can
  // appear in front of ANY path, and the subdomain redirect has to see every page request, so the
  // narrow list of gated prefixes this used to carry would miss both.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml|webmanifest)$).*)'],
};
