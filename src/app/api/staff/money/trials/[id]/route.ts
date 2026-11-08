import { NextResponse } from 'next/server';

import { requireOwnerApi } from '@/lib/ownerAccess';
import { revokeTrial } from '@/lib/ownerTrials';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id' }, { status: 400 });
  if (!(await revokeTrial(id, gate.actor.user.userId))) return NextResponse.json({ error: 'No running trial with that id.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
