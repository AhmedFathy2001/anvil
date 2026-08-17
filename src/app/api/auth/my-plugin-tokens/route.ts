import { NextResponse } from 'next/server';
import { db } from '@/db';
import { pluginLinks } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// GET /api/auth/my-plugin-tokens — the calling user's active legacy admin plugin tokens
// (`plugin_links`; raw token returned, owner-only, sensitive).
//
// This used to serve federation tokens alongside them for the profile's "Connected plugins" panel.
// Federation is gone and that panel with it, so nothing in-repo calls this today — it is kept
// because it remains the ONLY way to revoke a leaked `plugin_links` token, and those rows have no
// expiry, only `revokedAt`. Removing it would quietly delete a security control. The legacy token
// family is retired properly when the permission rework lands.
export async function GET() {
  const session = await verifyUser();
  if (!session || session.userId <= 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const links = await db.query.pluginLinks.findMany({
    where: and(eq(pluginLinks.userId, session.userId), isNull(pluginLinks.revokedAt)),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });

  return NextResponse.json({
    pluginLinks: links.map((r) => ({
      id: r.id,
      token: r.token,
      createdAt: r.createdAt,
      lastUsedAt: r.lastUsedAt,
    })),
  });
}

// DELETE ?id=<n> — soft-revoke one of the caller's own plugin_links tokens.
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
  if (link.revokedAt) return NextResponse.json({ success: true, alreadyRevoked: true });
  await db.update(pluginLinks).set({ revokedAt: new Date().toISOString() }).where(eq(pluginLinks.id, id));
  return NextResponse.json({ success: true });
}
