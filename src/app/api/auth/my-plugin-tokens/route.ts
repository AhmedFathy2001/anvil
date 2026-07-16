import { NextResponse } from 'next/server';
import { db } from '@/db';
import { federationTokens, pluginLinks } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// GET /api/auth/my-plugin-tokens — the calling user's active plugin credentials, for the profile
// "Connected plugins" surface. Two kinds:
//   • pluginLinks       — the legacy admin plugin token (raw token returned; owner-only, sensitive).
//   • federationTokens  — Layer-0/1 federation tokens (WIRE §4). The raw token is NEVER returned
//                         (it's stored hashed and only shown once at mint); only its metadata is.
//
// Shape is an object so the two lists stay distinct; nothing in-repo consumed the previous bare
// array, so this is a safe extension.
export async function GET() {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [links, fedTokens] = await Promise.all([
    db.query.pluginLinks.findMany({
      where: and(eq(pluginLinks.userId, session.userId), isNull(pluginLinks.revokedAt)),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
    }),
    db.query.federationTokens.findMany({
      where: and(eq(federationTokens.userId, session.userId), isNull(federationTokens.revokedAt)),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
  ]);

  return NextResponse.json({
    pluginLinks: links.map((r) => ({
      id: r.id,
      token: r.token,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
    })),
    federationTokens: fedTokens.map((t) => {
      let scopes: string[] = [];
      try {
        const parsed = JSON.parse(t.scopes);
        if (Array.isArray(parsed)) scopes = parsed.filter((s): s is string => typeof s === 'string');
      } catch {
        /* ignore malformed */
      }
      return {
        tokenId: t.tokenId,
        label: t.label,
        scopes,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt,
      };
    }),
  });
}

// DELETE — revoke a credential. Query params (one of):
//   • ?id=<n>                     soft-revoke a pluginLinks token (existing behaviour).
//   • ?federationTokenId=<uuid>   revoke one federation token by its tokenId.
//   • ?federationRevokeAll=1      revoke ALL of the user's active federation tokens (revoke-all).
// All owner-scoped: a user can only revoke their own.
export async function DELETE(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const nowIso = new Date().toISOString();

  // Federation: revoke-all.
  if (url.searchParams.get('federationRevokeAll')) {
    await db
      .update(federationTokens)
      .set({ revokedAt: nowIso })
      .where(
        and(eq(federationTokens.userId, session.userId), isNull(federationTokens.revokedAt)),
      );
    return NextResponse.json({ success: true });
  }

  // Federation: revoke one by tokenId.
  const fedTokenId = url.searchParams.get('federationTokenId');
  if (fedTokenId) {
    const target = await db.query.federationTokens.findFirst({
      where: eq(federationTokens.tokenId, fedTokenId),
    });
    if (!target || target.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (target.revokedAt) return NextResponse.json({ success: true, alreadyRevoked: true });
    await db
      .update(federationTokens)
      .set({ revokedAt: nowIso })
      .where(eq(federationTokens.id, target.id));
    return NextResponse.json({ success: true });
  }

  // Legacy pluginLinks revoke by numeric id.
  const id = Number(url.searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }
  const link = await db.query.pluginLinks.findFirst({ where: eq(pluginLinks.id, id) });
  if (!link || link.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (link.revokedAt) return NextResponse.json({ success: true, alreadyRevoked: true });
  await db.update(pluginLinks).set({ revokedAt: nowIso }).where(eq(pluginLinks.id, id));
  return NextResponse.json({ success: true });
}
