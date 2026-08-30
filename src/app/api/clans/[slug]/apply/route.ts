import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, clanMemberships } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { resolveClanBySlug } from '@/lib/clanContext';
import { admit } from '@/lib/guestAdmission';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Asking to join a clan, from the site.
 *
 * The clan's public home has always offered this — "Apply on Discord" when an invite is configured,
 * "Sign in to apply" when one is not — and behind the second there was nothing at all. Signing in
 * made the button disappear, which is a worse state than not being signed in: the promise was made
 * and then withdrawn. `guestPolicy: 'approval'` and `clan_blocks` were both designed around an
 * application endpoint that had never been built.
 *
 * Everything it needs already exists. `admit()` is the one door onto a roster — it checks the ban,
 * honours the clan's policy, and files a request when the answer is "a human decides" — so this adds
 * an address, not a rule. A clan whose policy is `open` is joined outright; `approval` files a
 * request that /admin/clan now shows; `closed` is refused.
 *
 * Addressed by SLUG rather than by the clan prefix: /api/clans is a platform root, so this route is
 * reachable identically from the apex directory and from inside the clan's own pages.
 */

/** Which characters could apply, so the page can offer a choice before anyone presses anything. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await verifyUser();
  const clan = await resolveClanBySlug((await params).slug);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!session?.playerId) return NextResponse.json({ signedIn: false, options: [] });

  const seated = await db
    .select({ accountId: clanMemberships.accountId })
    .from(clanMemberships)
    .where(and(eq(clanMemberships.clanId, clan.id), isNull(clanMemberships.leftAt)));
  const seatedIds = new Set(seated.map((r) => r.accountId));

  const options = (
    await db
      .select({ id: accounts.id, rsn: accounts.rsn, verifiedAt: accounts.verifiedAt })
      .from(accounts)
      .where(eq(accounts.playerId, session.playerId))
  )
    .filter((a) => a.verifiedAt != null && !seatedIds.has(a.id))
    .map((a) => ({ id: a.id, rsn: a.rsn }));

  // Already in with every character they have — there is nothing here to ask for.
  const alreadyIn = options.length === 0 && seatedIds.size > 0;

  return NextResponse.json({ signedIn: true, guestPolicy: clan.guestPolicy, alreadyIn, options });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await verifyUser();
  if (!session?.playerId) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const clan = await resolveClanBySlug((await params).slug);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Same shape as entering an event, and for the same reason: this creates a seat on somebody's
  // roster, which is cheap to attempt and cheap to abuse.
  const limited = await rateLimitByKey('clan-apply', String(session.userId), { limit: 10, windowMs: 3600_000 });
  if (!limited.ok) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const accountId = Number(body?.accountId);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: 'Which character are you applying with?' }, { status: 400 });
  }

  // Theirs, and verified — the same bar the sign-up form and the event door apply. An application
  // is a claim about a character, and an unproven one is not worth a moderator's time.
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, accountId), eq(accounts.playerId, session.playerId)),
  });
  if (!account) return NextResponse.json({ error: 'Not your character' }, { status: 403 });
  if (!account.verifiedAt) {
    return NextResponse.json({ error: `${account.rsn} has to be verified first.` }, { status: 403 });
  }

  const message = typeof body?.message === 'string' ? body.message : undefined;
  const admission = await admit({ clanId: clan.id, accountId, source: 'web', message });

  if (admission.outcome === 'refused') {
    // The ban is told plainly and the closed door is not — being barred is a decision the person
    // needs to know about, while "not recruiting" is simply the clan's current setting.
    return NextResponse.json(
      { error: admission.reason === 'banned' ? 'This clan has barred you.' : 'This clan is not taking applications.' },
      { status: 403 },
    );
  }

  if (admission.outcome === 'seated') {
    return NextResponse.json({ ok: true, seated: true, message: `You’re in — welcome to ${clan.name}.` });
  }

  return NextResponse.json(
    { ok: true, pending: true, message: 'Sent — their staff will review it.' },
    { status: 202 },
  );
}
