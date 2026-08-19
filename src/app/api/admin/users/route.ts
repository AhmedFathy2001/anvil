import { NextResponse } from 'next/server';
import { requireClanFromRequest } from '@/lib/clanContext';
import { verifyAdmin } from '@/lib/auth';
import { getPeopleWithCharacters, getUnlinkedCharacters } from '@/lib/identity';

// Person-first list: every site user with the game accounts (characters) they own + ban/role/owner
// state, plus the pool of unlinked roster/guest accounts an admin can assign. Backed by the shared
// identity layer so admin and profile present identity identically.
export async function GET(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const clan = await requireClanFromRequest(request);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [people, unlinked] = await Promise.all([
    getPeopleWithCharacters(clan.id),
    getUnlinkedCharacters(clan.id),
  ]);
  return NextResponse.json({ people, unlinked });
}
