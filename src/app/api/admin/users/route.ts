import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { getPeopleWithCharacters } from '@/lib/identity';

// Person-first list: every site user with the game accounts (characters) they own + ban/role/owner
// state. Backed by the shared identity layer so admin and profile present identity identically.
export async function GET() {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await getPeopleWithCharacters());
}
