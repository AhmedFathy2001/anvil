import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { chatPatternOverrides } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { CHAT_PATTERN_CATALOG, checkOverride, listOverrides } from '@/lib/chatPatterns';

// /api/staff/chat-patterns — the chat-line overrides every plugin polls (lib/chatPatterns). GET is
// the catalog plus what is overridden; PUT saves one override; DELETE ?key= returns a key to the
// plugin's built-in pattern.

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  return NextResponse.json({ catalog: CHAT_PATTERN_CATALOG, overrides: await listOverrides() });
}

export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  let body: { key?: unknown; regex?: unknown; hint?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const regex = typeof body.regex === 'string' ? body.regex : '';
  const check = checkOverride(key, regex);
  if (check.errors.length) return NextResponse.json({ error: check.errors.join(' '), ...check }, { status: 400 });
  const hint = typeof body.hint === 'string' && body.hint.trim() ? body.hint.slice(0, 120) : null;
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.slice(0, 500) : null;
  const set = { regex, hint, note, updatedBy: gate.actor.user.userId, updatedAt: new Date().toISOString() };
  await db
    .insert(chatPatternOverrides)
    .values({ key, ...set })
    .onConflictDoUpdate({ target: chatPatternOverrides.key, set });
  return NextResponse.json({ ok: true, warnings: check.warnings });
}

export async function DELETE(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const key = new URL(request.url).searchParams.get('key')?.trim();
  if (!key) return NextResponse.json({ error: 'key' }, { status: 400 });
  await db.delete(chatPatternOverrides).where(eq(chatPatternOverrides.key, key));
  return NextResponse.json({ ok: true });
}
