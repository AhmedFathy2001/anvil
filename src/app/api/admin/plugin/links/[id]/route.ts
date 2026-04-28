import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { db } from '@/db';
import { pluginLinks } from '@/db/schema';
import { eq } from 'drizzle-orm';

// DELETE — revoke a plugin link. Admins can revoke anyone's; others only their own.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const linkId = Number(id);
  if (!Number.isInteger(linkId)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const link = await db.query.pluginLinks.findFirst({ where: eq(pluginLinks.id, linkId) });
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (user.role !== 'admin' && link.userId !== user.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await db
    .update(pluginLinks)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(pluginLinks.id, linkId));

  return NextResponse.json({ ok: true });
}
