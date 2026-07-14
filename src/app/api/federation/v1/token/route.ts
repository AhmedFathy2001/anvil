import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, federationTokens, pluginLinkCodes, users } from '@/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import {
  generateFederationToken,
  generateFederationTokenId,
  getInstanceId,
  hashFederationToken,
  sanitizeScopes,
} from '@/lib/federation';

export const dynamic = 'force-dynamic';

// POST /api/federation/v1/token — OWN issuance (WIRE §4, FEDERATION.md L0).
//
// The instance is always the authority over its own tokens: authenticate the caller against THIS
// instance's own login — either an active web session (the 30-day Discord-OAuth cookie) or a
// single-use plugin link code (the existing find-or-create-user path) — then mint an opaque, hashed,
// long-lived + revocable federation token and return it exactly ONCE. The broker's /exchange (L2)
// mints the same federation_tokens shape from a broker assertion; that is a later track.
export async function POST(request: Request) {
  // Rate-limited (WIRE §8): brute-forcing link codes here must be as expensive as at /plugin/link.
  const rl = await rateLimit(request, 'federation-token', { limit: 20, windowMs: 5 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  }

  let body: { code?: string; scopes?: unknown; label?: string } = {};
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  }

  // --- Authenticate to a site user. Prefer an existing web session; else consume a link code. ---
  let userId: number | null = null;
  const session = await verifyUser();
  if (session?.userId) {
    userId = session.userId;
  } else if (typeof body.code === 'string' && body.code.trim()) {
    const code = body.code.trim().toUpperCase();
    if (code.length !== 6) {
      return NextResponse.json({ error: 'A 6-character code is required' }, { status: 400 });
    }
    const nowIso = new Date().toISOString();
    // Atomic single-use consume — same flip-consumedAt guard as /api/plugin/link.
    const consumed = await db
      .update(pluginLinkCodes)
      .set({ consumedAt: nowIso })
      .where(
        and(
          eq(pluginLinkCodes.code, code),
          isNull(pluginLinkCodes.consumedAt),
          sql`${pluginLinkCodes.expiresAt} > ${nowIso}`,
        ),
      )
      .returning();
    const codeRow = consumed[0];
    if (!codeRow) {
      return NextResponse.json({ error: 'Invalid, already-used, or expired code' }, { status: 400 });
    }
    userId = codeRow.userId;
  }

  if (userId == null) {
    return NextResponse.json(
      { error: 'Authenticate with a web session or a plugin link code' },
      { status: 401 },
    );
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return NextResponse.json({ error: 'User no longer exists' }, { status: 403 });
  // A banned user gets no credential — matches the OAuth-callback door check.
  if (user.banned) return NextResponse.json({ error: 'Account is banned' }, { status: 403 });

  // Optionally pin the token to the user's primary linked account (WIRE §4 memberId). Best-effort:
  // a user with no linked account still gets a token (discordId carries the identity for L2).
  const primary = await db.query.clanMembers.findFirst({
    where: and(
      eq(clanMembers.userId, user.id),
      isNull(clanMembers.leftAt),
      eq(clanMembers.isPrimary, 1),
    ),
    columns: { id: true },
  });

  const scopes = sanitizeScopes(body.scopes);
  const label =
    typeof body.label === 'string' && body.label.trim() ? body.label.trim().slice(0, 80) : null;

  const rawToken = generateFederationToken();
  const tokenId = generateFederationTokenId();
  await db.insert(federationTokens).values({
    tokenId,
    tokenHash: hashFederationToken(rawToken),
    userId: user.id,
    discordId: user.discordId ?? null,
    memberId: primary?.id ?? null,
    scopes: JSON.stringify(scopes),
    label,
  });

  const instanceId = await getInstanceId();

  // `token` is returned exactly once and never persisted (only its SHA-256 hash is stored).
  return NextResponse.json(
    { token: rawToken, tokenId, scopes, label, instanceId },
    { headers: rateLimitHeaders(rl) },
  );
}
