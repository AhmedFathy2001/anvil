import { NextResponse } from 'next/server';
import { verifyUser } from '@/lib/auth';
import { withdrawProposal } from '@/lib/libraryProposals';

// DELETE — withdraw your own suggestion while it's still waiting.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  try {
    await withdrawProposal(Number((await params).id), session.userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
