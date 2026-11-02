import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { modeLinePatterns, modeLineSamples } from '@/db/schema';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';
import { BUILTIN_PATTERNS, MODE_EVENT_KINDS, checkPattern, compilePattern } from '@/lib/modeLines';
import { forgetPatternCache, listPatterns, listSamples, toPattern } from '@/lib/modeLineStore';
import { WORLD_MODES, isModeKey } from '@/lib/worldModes';

// /api/staff/mode-lines — the game-mode event patterns (lib/modeLines) and the queue of lines none
// of them knew.
//   GET                          built-ins, staff patterns, the queue
//   PUT { id?, modeKey, kind, regex, title, note }   save a pattern (no id = new); the queue rows it
//                                now recognises are cleared
//   DELETE ?id=<pattern> | ?sample=<row>              remove a pattern, or dismiss a queued line

export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;
  const [patterns, samples] = await Promise.all([listPatterns(), listSamples()]);
  return NextResponse.json({
    builtins: BUILTIN_PATTERNS,
    patterns,
    samples,
    kinds: MODE_EVENT_KINDS,
    modes: WORLD_MODES.map((m) => ({ key: m.key, label: m.label })),
  });
}

export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const modeKey = typeof body.modeKey === 'string' && body.modeKey ? body.modeKey : null;
  if (modeKey !== null && !isModeKey(modeKey)) return NextResponse.json({ error: 'Unknown game mode.' }, { status: 400 });
  const input = {
    modeKey,
    kind: typeof body.kind === 'string' ? body.kind : '',
    regex: typeof body.regex === 'string' ? body.regex : '',
    title: typeof body.title === 'string' ? body.title.trim() : '',
  };
  const errors = checkPattern(input);
  if (errors.length) return NextResponse.json({ error: errors.join(' ') }, { status: 400 });
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null;
  const set = { ...input, note, updatedBy: gate.actor.user.userId, updatedAt: new Date().toISOString() };

  const id = typeof body.id === 'number' && Number.isInteger(body.id) ? body.id : null;
  let row;
  if (id !== null) {
    [row] = await db.update(modeLinePatterns).set(set).where(eq(modeLinePatterns.id, id)).returning();
    if (!row) return NextResponse.json({ error: 'No such pattern.' }, { status: 404 });
  } else {
    [row] = await db.insert(modeLinePatterns).values(set).returning();
  }
  forgetPatternCache();

  // The queued lines this pattern now answers for are done with.
  const pattern = toPattern(row);
  const re = pattern ? compilePattern(pattern.regex) : null;
  let cleared = 0;
  if (pattern && re) {
    const done = (await listSamples(5000))
      .filter((s) => (pattern.modeKey === null || pattern.modeKey === s.modeKey) && re.test(s.sample))
      .map((s) => s.id);
    if (done.length) {
      await db.delete(modeLineSamples).where(inArray(modeLineSamples.id, done));
      cleared = done.length;
    }
  }
  return NextResponse.json({ ok: true, pattern: row, cleared });
}

export async function DELETE(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const params = new URL(request.url).searchParams;
  const id = Number(params.get('id'));
  const sample = Number(params.get('sample'));
  if (Number.isInteger(id) && id > 0) {
    await db.delete(modeLinePatterns).where(eq(modeLinePatterns.id, id));
    forgetPatternCache();
    return NextResponse.json({ ok: true });
  }
  if (Number.isInteger(sample) && sample > 0) {
    await db.delete(modeLineSamples).where(eq(modeLineSamples.id, sample));
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'id or sample' }, { status: 400 });
}
