import { NextResponse } from 'next/server';
import { db } from '@/db';
import { clanAuditLog, clanMembers, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { applyPendingRole } from '@/lib/pending-role';

const VALID = new Set(['admin', 'moderator']);

// PUT /api/admin/clan/[id]/pending-role { role: 'admin' | 'moderator' | null }
//
// Stamps a pre-assigned role onto a clan member. When the member later claims their
// account via the plugin (high-trust), the role applies immediately. If they claim
// via stat-delta / manual (provisional), the role waits for mod approval. Setting
// role=null clears any pending assignment.
//
// If the member is already claimed AND not provisional, we apply the role right
// away — no point queuing it for a future event that's already happened.
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifyUser();
  const actorUserId = session && session.userId > 0 ? session.userId : null;

  const { id } = await params;
  const memberId = Number(id);
  if (!Number.isFinite(memberId) || memberId <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: { role?: 'admin' | 'moderator' | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const role = body.role ?? null;
  if (role !== null && !VALID.has(role)) {
    return NextResponse.json({ error: "role must be 'admin', 'moderator', or null" }, { status: 400 });
  }

  const member = await db.query.clanMembers.findFirst({ where: eq(clanMembers.id, memberId) });
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  await db.update(clanMembers).set({ pendingRole: role }).where(eq(clanMembers.id, memberId));

  db.insert(clanAuditLog)
    .values({
      clanMemberId: memberId,
      eventType: 'role_pre_assigned',
      oldValue: JSON.stringify({ pendingRole: member.pendingRole }),
      newValue: JSON.stringify({ pendingRole: role }),
      actorUserId,
    })
    .catch(() => {});

  let appliedNow = false;
  if (role && member.userId && !member.provisional) {
    // Already verified non-provisional account — apply immediately.
    appliedNow = await applyPendingRole(memberId, member.userId, 'manual_approval');
  }

  // Echo the resolved state for the client.
  const finalUser = member.userId
    ? await db.query.users.findFirst({ where: eq(users.id, member.userId), columns: { id: true, role: true } })
    : null;

  return NextResponse.json({
    success: true,
    pendingRole: appliedNow ? null : role,
    appliedNow,
    user: finalUser,
  });
}
