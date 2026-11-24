import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { bad, intParam, readJson, signedIn } from '@/lib/guideApi';
import { guideViewer } from '@/lib/guideViewer';
import { clearSkip, isSkipReason, setBudgetCap, setSkip } from '@/lib/playerItems';

// The reader's own guide preferences and items. OWNER-ONLY: everything here is the signed-in
// person's main character, never anyone else's (lib/playerItems snapshotForViewer).

// GET — skips, budget cap, and "Fill from my plugin": the worn gear and inventory the plugin last read.
export async function GET() {
  const user = await verifyUser();
  if (!user) return bad('Sign in first.', 401);
  const v = await guideViewer(user, { items: true });
  const worn = v.snapshot?.equipment ?? null;
  const inv = v.snapshot?.inventory ?? null;
  return NextResponse.json(
    {
      rsn: v.rsn,
      skipped: [...(v.prefs?.skipped.entries() ?? [])].map(([itemId, reason]) => ({ itemId, reason })),
      budgetCap: v.prefs?.budgetCap ?? null,
      fill: worn || inv ? { equipment: worn?.items ?? [], inventory: inv?.items ?? [], readAt: worn?.readAt ?? inv?.readAt ?? null } : null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

// POST — { action: 'skip', itemId, reason } · { action: 'unskip', itemId } · { action: 'budget', gp | null }.
export async function POST(request: Request) {
  const gate = await signedIn('prefs', 60);
  if ('response' in gate) return gate.response;
  const v = await guideViewer(gate.user);
  if (!v.accountId) return bad('Link a character first: skips and budgets are kept per character.');
  const body = await readJson(request);
  const itemId = intParam(body?.itemId);
  switch (body?.action) {
    case 'skip':
      if (!itemId) return bad('Unknown item.');
      await setSkip(v.accountId, itemId, isSkipReason(body.reason) ? body.reason : 'dont_want');
      break;
    case 'unskip':
      if (itemId) await clearSkip(v.accountId, itemId);
      break;
    case 'budget':
      await setBudgetCap(v.accountId, typeof body.gp === 'number' ? body.gp : null);
      break;
    default:
      return bad('Bad request');
  }
  return NextResponse.json({ ok: true });
}
