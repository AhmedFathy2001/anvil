import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { events } from '@/db/schema';
import { verifyAdminOrModerator } from '@/lib/auth';
import { requireEventForPage } from '@/lib/eventScope';
import { parseEventRules } from '@/lib/eventRules';
import { rulebookForEvent } from '@/lib/eventRulebook';

/** Longer than any Discord embed will show — the rest is what the "full rules" link is for. */
const MAX_RULEBOOK = 20_000;

/**
 * The board's own rulebook and whether it posts at start.
 *
 * ITS OWN ENDPOINT for the same reason as signup-fields: the event PATCH takes the WHOLE rules
 * object, and a text box shouldn't round-trip every rule it doesn't care about to change one. The
 * flag is merged into the STORED rules JSON, so no other default gets materialised.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const row = await requireEventForPage(id);
  // What players see when the box is blank: the clan's house rules, shown as the placeholder.
  const fallback = await rulebookForEvent({ clanId: row.clanId, rulebook: null });
  return NextResponse.json({
    rulebook: row.rulebook ?? '',
    rulesAtStart: parseEventRules(row.rules).rulesAtStart,
    clanRules: fallback.text ?? '',
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const id = Number((await params).eventId);
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const event = await requireEventForPage(id);

  const body = (await request.json().catch(() => null)) as { rulebook?: unknown; rulesAtStart?: unknown } | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const updates: Partial<typeof events.$inferInsert> = {};
  if (body.rulebook !== undefined) {
    if (body.rulebook !== null && typeof body.rulebook !== 'string') {
      return NextResponse.json({ error: 'rulebook must be text' }, { status: 400 });
    }
    const text = (body.rulebook ?? '').trim();
    if (text.length > MAX_RULEBOOK) {
      return NextResponse.json({ error: `Rules are limited to ${MAX_RULEBOOK.toLocaleString()} characters` }, { status: 400 });
    }
    updates.rulebook = text || null;
  }
  if (body.rulesAtStart !== undefined) {
    if (typeof body.rulesAtStart !== 'boolean') {
      return NextResponse.json({ error: 'rulesAtStart must be a boolean' }, { status: 400 });
    }
    let stored: Record<string, unknown> = {};
    try {
      const parsed = event.rules ? JSON.parse(event.rules) : {};
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed;
    } catch {
      stored = {};
    }
    // Default is on, so "on" is stored as absence — the column stays NULL on a classic board.
    if (body.rulesAtStart) delete stored.rulesAtStart;
    else stored.rulesAtStart = false;
    updates.rules = Object.keys(stored).length ? JSON.stringify(stored) : null;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  await db.update(events).set(updates).where(eq(events.id, event.id));
  return NextResponse.json({ ok: true });
}
