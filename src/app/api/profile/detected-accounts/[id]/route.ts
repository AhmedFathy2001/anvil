import { NextResponse } from 'next/server';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { detectedAccounts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { claimAccountForUser, verifyUser } from '@/lib/auth';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

// POST /api/profile/detected-accounts/[id]
// Body: { action: 'link' | 'dismiss' }
//
// Resolves one plugin-detected suggestion:
//   • link    → attribute + verify the account to this user, then drop the suggestion.
//   • dismiss → opt out; the row stays 'dismissed' so it isn't re-suggested on the next play.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const rl = await rateLimit(request, 'detected-action', { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });
  const clan = await requireClan();
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const action = body.action;
  if (action !== 'link' && action !== 'dismiss') {
    return NextResponse.json({ error: "action must be 'link' or 'dismiss'" }, { status: 400 });
  }

  // Scope to the caller's own suggestions — a user can only act on their own inbox.
  const detection = await db.query.detectedAccounts.findFirst({
    where: and(eq(detectedAccounts.id, id), eq(detectedAccounts.userId, session.userId)),
  });
  if (!detection) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (action === 'dismiss') {
    await db.update(detectedAccounts).set({ status: 'dismissed' }).where(eq(detectedAccounts.id, id));
    return NextResponse.json({ ok: true, status: 'dismissed' });
  }

  const result = await claimAccountForUser(
    clan.id,
    session.userId,
    detection.rsn,
    detection.rsnNormalized,
    detection.accountHash,
  );
  if (!result.ok) {
    if (result.reason === 'needs-verification') {
      return NextResponse.json(
        {
          error:
            'For your security we can’t add an account that’s already on the clan roster from a name alone. ' +
            'Link it with the quick in-game check under “Link a RuneScape account” (an XP gain or the plugin link code) to prove it’s yours.',
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'This RuneScape account is already linked to a different site user.' },
      { status: 409 },
    );
  }

  // Linked — the suggestion has served its purpose; remove it so it never resurfaces.
  await db.delete(detectedAccounts).where(eq(detectedAccounts.id, id));
  return NextResponse.json({ ok: true, status: 'linked', clanMemberId: result.clanMemberId });
}
