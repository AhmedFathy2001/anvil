import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { db } from '@/db';
import { clans, feedback, users } from '@/db/schema';
import { requirePlatformApi } from '@/lib/platformAccess';

/**
 * Every clan's feedback, for the operator.
 *
 * PLATFORM-SCOPED ON PURPOSE, and it is the one read here that must not carry a clan filter: the
 * question is "what has anybody reported about Anvil", which spans clans by definition. Gated behind
 * `requirePlatformApi`, which no clan role can confer — /api/* is never covered by middleware, so
 * this route checks for itself rather than trusting the layout above the page.
 *
 * Elevation is gone. It POSTed a row to the separate Anvil.Admin control plane so the operator would
 * see it; the operator reads this table directly now, so the forwarding was a round trip to tell
 * another service something this database already held.
 */
export async function GET() {
  const gate = await requirePlatformApi('support');
  if ('response' in gate) return gate.response;

  // clan-scope: global -- reports about the PRODUCT, read by the platform operator; the clan is a
  // column here rather than a filter, which is the whole point of the surface.
  const rows = await db
    .select({
      id: feedback.id,
      kind: feedback.kind,
      subject: feedback.subject,
      body: feedback.body,
      status: feedback.status,
      contact: feedback.contact,
      pageUrl: feedback.pageUrl,
      adminNotes: feedback.adminNotes,
      createdAt: feedback.createdAt,
      reporter: users.displayName,
      clanName: clans.name,
      clanSlug: clans.slug,
    })
    .from(feedback)
    .leftJoin(users, eq(feedback.userId, users.id))
    .leftJoin(clans, eq(feedback.clanId, clans.id))
    .orderBy(desc(feedback.createdAt));

  return NextResponse.json({ items: rows });
}

const STATUSES = ['open', 'in_progress', 'resolved', 'closed'];

/** Set a report's status and the operator's private notes. Same authority as reading them. */
export async function PATCH(request: Request) {
  const gate = await requirePlatformApi('staff');
  if ('response' in gate) return gate.response;

  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const set: Record<string, unknown> = {};
  if (body?.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    set.status = body.status;
  }
  if (typeof body?.adminNotes === 'string') {
    set.adminNotes = body.adminNotes.trim().slice(0, 2000) || null;
  }
  if (Object.keys(set).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  set.updatedAt = new Date().toISOString();

  await db.update(feedback).set(set).where(eq(feedback.id, id));
  return NextResponse.json({ ok: true });
}
