import { NextResponse } from 'next/server';

import { ledgerDetail } from '@/lib/money';
import { requireOwnerApi } from '@/lib/ownerAccess';

// The one place a full buyer email is returned. Owner only.
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireOwnerApi();
  if ('response' in gate) return gate.response;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'id' }, { status: 400 });
  const detail = await ledgerDetail(id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
}
