import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { blockClanAsUser, isAdminOf, listBlockedClans, listBlockedClansAsUser, unblockClan } from '@/lib/clanBlocks';

/**
 * Settings → Blocked clans (lib/clanBlocks). Owner/admin of the addressed clan only — checked
 * against clan_staff in the lib, so a role somewhere else doesn't count.
 *
 * GET → { blocked }   POST { slug } → block   DELETE ?clanId= → unblock
 */
async function scope(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return { error: NextResponse.json({ error: 'Sign in first.' }, { status: 401 }) };
  const clan = await resolveClanFromRequest(request);
  if (!clan) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  // Every method, reads included: who a clan has blocked is its owner/admins' business.
  if (!(await isAdminOf(clan.id, session.userId))) return { error: forbidden() };
  return { clanId: clan.id, userId: session.userId };
}

function forbidden() {
  return NextResponse.json({ error: 'Only an owner or admin can manage blocked clans' }, { status: 403 });
}

export async function GET(request: Request) {
  const s = await scope(request);
  if ('error' in s) return s.error;
  const blocked = await listBlockedClansAsUser(s.clanId, s.userId);
  if (!blocked) return forbidden();
  return NextResponse.json({ blocked });
}

export async function POST(request: Request) {
  const s = await scope(request);
  if ('error' in s) return s.error;
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const target = slug ? await db.query.clans.findFirst({ where: eq(clans.slug, slug), columns: { id: true } }) : null;
  if (!target) return NextResponse.json({ error: 'No clan with that address' }, { status: 404 });
  if (target.id === s.clanId) return NextResponse.json({ error: 'That is your own clan' }, { status: 400 });
  if (!(await blockClanAsUser(s.clanId, target.id, s.userId))) return forbidden();
  return NextResponse.json({ blocked: await listBlockedClans(s.clanId) });
}

export async function DELETE(request: Request) {
  const s = await scope(request);
  if ('error' in s) return s.error;
  const blockedClanId = Number(new URL(request.url).searchParams.get('clanId'));
  if (!(await unblockClan(s.clanId, blockedClanId, s.userId))) return forbidden();
  return NextResponse.json({ blocked: await listBlockedClans(s.clanId) });
}
