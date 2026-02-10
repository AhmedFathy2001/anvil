import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'admin-secret';
const CAPTAIN_SESSION_SECRET = process.env.CAPTAIN_SESSION_SECRET || 'captain-secret';
const PLAYER_SESSION_SECRET = process.env.PLAYER_SESSION_SECRET || 'player-secret';

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

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

  // Protect admin routes (except the login page itself)
  if (pathname.startsWith('/admin') && pathname !== '/admin') {
    const token = request.cookies.get('admin_session')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    const payload = await verifyToken(token, ADMIN_SESSION_SECRET);
    if (!payload) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    try {
      const data = JSON.parse(payload);
      const role = data.role;

      // Must be admin or moderator
      if (role !== 'admin' && role !== 'moderator') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }

      // Moderators can only access /admin/weekly* routes
      if (role === 'moderator') {
        if (!pathname.startsWith('/admin/weekly')) {
          return NextResponse.redirect(new URL('/admin/weekly', request.url));
        }
      }
    } catch {
      return NextResponse.redirect(new URL('/admin', request.url));
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

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/captain/:path*', '/player/dashboard'],
};
