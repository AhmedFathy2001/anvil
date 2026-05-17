import { NextResponse } from 'next/server';
import { db } from '@/db';
import { pluginLinks } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// GET /api/auth/my-plugin-tokens — returns the calling user's active plugin_links rows
// so they can copy the existing token directly into the plugin's "Admin plugin token"
// field after a local config wipe (e.g. `gradle runClient` resetting RuneLite profile,
// reinstall, machine swap). Skips the bootstrap-code dance entirely.
//
// Tokens are sensitive — only the owner can read them, and only via this authenticated
// endpoint. Never logged, never in URLs.
export async function GET() {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db.query.pluginLinks.findMany({
    where: and(eq(pluginLinks.userId, session.userId), isNull(pluginLinks.revokedAt)),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      token: r.token,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
    })),
  );
}

// DELETE /api/auth/my-plugin-tokens?id=123 — soft-revoke a token. Plugin sessions using it
// stop authenticating immediately; the user can then run the code flow again to mint a new one.
export async function DELETE(request: Request) {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'id required' }, { status: 400 });
  }

  const link = await db.query.pluginLinks.findFirst({ where: eq(pluginLinks.id, id) });
  if (!link || link.userId !== session.userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (link.revokedAt) {
    return NextResponse.json({ success: true, alreadyRevoked: true });
  }

  await db
    .update(pluginLinks)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(pluginLinks.id, id));

  return NextResponse.json({ success: true });
}
