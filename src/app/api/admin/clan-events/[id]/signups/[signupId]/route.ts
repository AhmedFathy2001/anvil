import { NextResponse } from 'next/server';

import { verifyAdminOrModerator } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { setSignupStatus } from '@/lib/clanEventSignups';
import { refreshClanEventPost } from '@/lib/clanEvents';

// Staff: approve a sign-up, turn it down, or take someone off.

const STATUSES = ['approved', 'rejected', 'withdrawn'] as const;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; signupId: string }> }) {
  if (!(await verifyAdminOrModerator())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const { id, signupId } = await params;
  const { status } = (await request.json().catch(() => ({}))) as { status?: unknown };
  const want = STATUSES.find((s) => s === status);
  if (!want) return NextResponse.json({ error: 'Approve, reject or withdraw.' }, { status: 400 });
  const r = await setSignupStatus(clan.id, Number(id), Number(signupId), want);
  if (r.ok) await refreshClanEventPost(clan.id, Number(id));
  return r.ok ? NextResponse.json({ signup: r.value }) : NextResponse.json({ error: r.error }, { status: r.status });
}
