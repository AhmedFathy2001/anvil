import { NextResponse } from 'next/server';
import { db } from '@/db';
import { federationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { resolveFederationToken } from '@/lib/federation';

export const dynamic = 'force-dynamic';

// POST /api/federation/v1/token/revoke — revoke a federation token by `tokenId` (WIRE §4). Sets
// revokedAt; the token 401s at /board on its next use. Idempotent. Authorized by ANY of:
//   • a web session owning the token (or an admin session), OR
//   • the bearer of a federation token owned by the same user (self / sibling revoke).
export async function POST(request: Request) {
  let body: { tokenId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const tokenId = typeof body.tokenId === 'string' ? body.tokenId.trim() : '';
  if (!tokenId) return NextResponse.json({ error: 'tokenId required' }, { status: 400 });

  const target = await db.query.federationTokens.findFirst({
    where: eq(federationTokens.tokenId, tokenId),
  });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const session = await verifyUser();
  const ctx = await resolveFederationToken(request);
  const authorizedBySession =
    !!session && (session.role === 'admin' || (target.userId != null && target.userId === session.userId));
  const authorizedByToken =
    !!ctx && (ctx.tokenId === tokenId || (ctx.userId != null && ctx.userId === target.userId));
  if (!authorizedBySession && !authorizedByToken) {
    return NextResponse.json({ error: 'Not authorized to revoke this token' }, { status: 401 });
  }

  if (target.revokedAt) {
    return NextResponse.json({ success: true, alreadyRevoked: true });
  }
  await db
    .update(federationTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(federationTokens.id, target.id));

  return NextResponse.json({ success: true });
}
