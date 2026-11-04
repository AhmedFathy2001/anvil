import { NextResponse } from 'next/server';

import { db } from '@/db';
import { clanAuditLog } from '@/db/schema';
import { verifyAdmin, verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { isCreatorSpace } from '@/lib/creatorSpaces';

type Clan = Awaited<ReturnType<typeof requireClan>>;

/**
 * The space-page editor's routes (/api/admin/creator/page/…): an admin of THIS space, and only on a
 * creator space. A clan has its own profile pages; the panel model is keyed by clan id so a Streaming
 * clan could be let in here later, but none is today.
 */
export async function spacePageGuard(): Promise<{ clan: Clan; actorUserId: number | null } | { error: NextResponse }> {
  const clan = await requireClan();
  if (!(await verifyAdmin())) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!isCreatorSpace(clan)) return { error: NextResponse.json({ error: 'Not a creator space' }, { status: 404 }) };
  const actor = await verifyUser();
  return { clan, actorUserId: actor?.userId ?? null };
}

/** One line in the space's own audit log. Fire-and-forget: a log write must not fail a save. */
export function auditSpacePage(clanId: number, actorUserId: number | null, what: string, detail?: unknown): void {
  db.insert(clanAuditLog)
    .values({
      clanId,
      eventType: 'creator_page_changed',
      actorUserId,
      newValue: detail === undefined ? null : JSON.stringify(detail).slice(0, 2000),
      notes: what,
    })
    .catch(() => {});
}
