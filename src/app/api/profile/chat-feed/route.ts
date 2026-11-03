import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { getChatFeedPrefs, setChatFeedPrefs } from '@/lib/chatFeed';
import { cleanPrefs } from '@/lib/chatFeedRules';

export const dynamic = 'force-dynamic';

// What the in-game chat feed shows this person (lib/chatFeedRules). The plugin holds only the on/off
// switch; everything finer is here, on the login, so it follows them to every clan and computer.

export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  return NextResponse.json(await getChatFeedPrefs(session.userId));
}

export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const prefs = cleanPrefs({ ...(await getChatFeedPrefs(session.userId)), ...body });
  await setChatFeedPrefs(session.userId, prefs);
  return NextResponse.json(prefs);
}
