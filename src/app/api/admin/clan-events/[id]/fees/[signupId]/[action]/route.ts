import { NextResponse } from 'next/server';

import { verifyAdmin, verifyAdminOrModerator, verifyFeeCollector, verifyUser } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { type FeeAction, moveFee } from '@/lib/clanEventSignups';
import { isClanMediaUrl } from '@/lib/storage';

// One move on a clan event entry fee — the same moves, and the same people, as a board's
// (api/admin/fees/[feeId]/*): collectors mark it paid, admins confirm or reset, any staff disputes.
// The rules live in lib/clanEventSignups moveFee (lib/feeRules underneath).

export async function POST(request: Request, { params }: { params: Promise<{ id: string; signupId: string; action: string }> }) {
  const { id, signupId, action } = await params;
  if (!['collect', 'confirm', 'dispute', 'reset'].includes(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const allowed =
    action === 'collect' ? await verifyFeeCollector() : action === 'dispute' ? await verifyAdminOrModerator() : (await verifyAdmin()) ? await verifyUser() : null;
  if (!allowed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => ({}))) as { proofUrl?: unknown; force?: unknown; note?: unknown };
  const proofUrl = typeof body.proofUrl === 'string' && body.proofUrl ? body.proofUrl : null;
  // Our upload, under this clan's prefix — a reset deletes the proof, so it must be this clan's file.
  if (proofUrl && !isClanMediaUrl(proofUrl, clan.slug)) return NextResponse.json({ error: 'Attach proof by uploading it here.' }, { status: 400 });
  const r = await moveFee(clan.id, Number(id), Number(signupId), action as FeeAction, allowed.userId, {
    proofUrl,
    force: body.force === true,
    note: typeof body.note === 'string' ? body.note : null,
  });
  return r.ok ? NextResponse.json({ signup: r.value }) : NextResponse.json({ error: r.error }, { status: r.status });
}
