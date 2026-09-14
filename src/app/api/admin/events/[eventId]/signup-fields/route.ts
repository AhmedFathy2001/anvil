import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireEventForPage } from '@/lib/eventScope';
import { DEFAULT_SIGNUP_FIELDS, parseEventRules, parseSignupFields, type SignupFields } from '@/lib/eventRules';

/**
 * Which optional sections this board's sign-up form asks for.
 *
 * ITS OWN ENDPOINT, not part of the event PATCH, because that one takes the WHOLE rules object and
 * re-derives the board from format and scoring mode. Sending it from a checkbox would mean a client
 * round-tripping every rule it does not care about in order to change one — and any field it failed
 * to send back would be silently reset. This merges one key and leaves the rest exactly as stored.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const event = await requireEventForPage(id);
  return NextResponse.json({ fields: parseEventRules(event.rules).signupFields });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const event = await requireEventForPage(id);

  const body = (await request.json().catch(() => null)) as { fields?: unknown } | null;
  if (!body || typeof body.fields !== 'object' || body.fields == null) {
    return NextResponse.json({ error: 'fields is required' }, { status: 400 });
  }

  const incoming = body.fields as Record<string, unknown>;
  const current = parseEventRules(event.rules).signupFields;
  // Only the keys actually sent move — a client that knows about four sections must not turn off a
  // fifth it has never heard of.
  const next: SignupFields = { ...current };
  for (const key of Object.keys(DEFAULT_SIGNUP_FIELDS) as (keyof SignupFields)[]) {
    if (typeof incoming[key] === 'boolean') next[key] = incoming[key] as boolean;
  }

  // Merged into the STORED object rather than the parsed one: writing the parsed shape back would
  // materialise every default as an explicit value, so a later change to a default would stop
  // reaching this board.
  let stored: Record<string, unknown> = {};
  try {
    const parsed = event.rules ? JSON.parse(event.rules) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed;
  } catch {
    stored = {};
  }
  stored.signupFields = next;

  await db.update(events).set({ rules: JSON.stringify(stored) }).where(eq(events.id, id));
  return NextResponse.json({ fields: parseSignupFields(next) });
}
