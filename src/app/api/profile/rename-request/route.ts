import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanMembers, pendingRenames } from '@/db/schema';
import { and, desc, eq, or } from 'drizzle-orm';
import { verifyUser } from '@/lib/auth';
import { submitRenameRequest } from '@/lib/weekly';

// Function-as-a-route deadline. The OLD-name hiscores snapshot we capture at submit
// time can take a couple seconds; the rest is DB. Stay well under the Pro default.
export const maxDuration = 30;

// GET — list the caller's own rename submissions (across every clan_member they own)
// so the /profile UI can render the queue and resolution history.
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      id: pendingRenames.id,
      clanMemberId: pendingRenames.clanMemberId,
      oldRsn: pendingRenames.oldRsn,
      newRsn: pendingRenames.newRsn,
      status: pendingRenames.status,
      resolution: pendingRenames.resolution,
      createdAt: pendingRenames.createdAt,
      reviewedAt: pendingRenames.reviewedAt,
    })
    .from(pendingRenames)
    .innerJoin(clanMembers, eq(pendingRenames.clanMemberId, clanMembers.id))
    .where(eq(clanMembers.userId, session.userId))
    .orderBy(desc(pendingRenames.createdAt))
    .limit(50);

  return NextResponse.json({ requests: rows });
}

// POST — submit a rename. Body: { clanMemberId?: number, newRsn: string }. If
// clanMemberId is omitted we default to the user's primary clan_member (or their
// only one, if they have a single linked account).
export async function POST(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { clanMemberId?: number; newRsn?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const newRsn = (body.newRsn || '').toString();
  if (!newRsn) return NextResponse.json({ error: 'newRsn is required' }, { status: 400 });

  // Resolve the target clan_member. If the caller supplied one, verify ownership.
  // Otherwise pick: primary > only-one.
  let cm = null;
  if (typeof body.clanMemberId === 'number') {
    cm = await db.query.clanMembers.findFirst({
      where: and(eq(clanMembers.id, body.clanMemberId), eq(clanMembers.userId, session.userId)),
    });
    if (!cm) return NextResponse.json({ error: 'Clan member not found or not owned by you' }, { status: 403 });
  } else {
    const owned = await db
      .select({ id: clanMembers.id, isPrimary: clanMembers.isPrimary })
      .from(clanMembers)
      .where(and(eq(clanMembers.userId, session.userId), or(eq(clanMembers.isPrimary, 1), eq(clanMembers.isPrimary, 0))));
    const primary = owned.find((r) => r.isPrimary === 1) ?? (owned.length === 1 ? owned[0] : null);
    if (!primary) {
      return NextResponse.json(
        { error: 'You have multiple linked accounts — specify clanMemberId' },
        { status: 400 },
      );
    }
    cm = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, primary.id) });
    if (!cm) return NextResponse.json({ error: 'Clan member not found' }, { status: 404 });
  }

  const result = await submitRenameRequest({
    clanMemberId: cm.id,
    newRsn,
    submittedByUserId: session.userId,
  });
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });

  return NextResponse.json({ id: result.id, status: 'pending' });
}
