import { NextResponse } from 'next/server';
import { db } from '@/db';
import { federationBans } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';

// Federation ban denylist (decision 4, WIRE §4). A sticky ban keyed on discord_id that the L2
// /exchange path will consult before auto-creating a guest — Remove alone is whack-a-mole; this
// stops the re-spawn. Admin-only. The table + these actions exist now; the enforcement call site in
// POST /exchange is wired by the L2 track.

// GET — list all federation bans.
export async function GET() {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const rows = await db
    .select()
    .from(federationBans)
    .orderBy(federationBans.at);
  return NextResponse.json(rows);
}

// POST — ban a discord_id. Idempotent: re-banning an existing id refreshes the reason/actor.
export async function POST(request: Request) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { discordId?: string; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const discordId = typeof body.discordId === 'string' ? body.discordId.trim() : '';
  if (!discordId) return NextResponse.json({ error: 'discordId required' }, { status: 400 });
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : null;

  const existing = await db.query.federationBans.findFirst({
    where: eq(federationBans.discordId, discordId),
  });
  const nowIso = new Date().toISOString();
  if (existing) {
    await db
      .update(federationBans)
      .set({ reason, at: nowIso, byUserId: user.userId })
      .where(eq(federationBans.id, existing.id));
    return NextResponse.json({ ok: true, id: existing.id, updated: true });
  }

  const inserted = await db
    .insert(federationBans)
    .values({ discordId, reason, at: nowIso, byUserId: user.userId })
    .returning();
  return NextResponse.json({ ok: true, id: inserted[0].id });
}

// DELETE ?discordId=… (or ?id=…) — lift a federation ban.
export async function DELETE(request: Request) {
  const user = await verifyUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(request.url);
  const discordId = url.searchParams.get('discordId')?.trim();
  const idParam = url.searchParams.get('id');

  if (discordId) {
    await db.delete(federationBans).where(eq(federationBans.discordId, discordId));
    return NextResponse.json({ ok: true });
  }
  const id = Number(idParam);
  if (Number.isFinite(id) && id > 0) {
    await db.delete(federationBans).where(eq(federationBans.id, id));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'discordId or id required' }, { status: 400 });
}
