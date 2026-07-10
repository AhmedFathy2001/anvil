import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { searchGuildMembersByName } from '@/lib/discord-roles';

// GET ?q=name — search the guild's members for the manual "link member to Discord" picker.
export async function GET(request: Request) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json({ members: await searchGuildMembersByName(q) });
}
