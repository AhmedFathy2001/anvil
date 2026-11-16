import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts } from '@/db/schema';
import { normalizeRsn, verifyUser } from '@/lib/auth';
import { claimBlockedBy } from '@/lib/accountClaim';
import { applyIntentOf, fileApplyIntent, onInGameList } from '@/lib/applyIntents';
import { isBannedFromClan } from '@/lib/clanBans';
import { validRsn } from '@/lib/rsnRules';
import { applyChoices } from '@/lib/clanApply';
import { resolveClanBySlug } from '@/lib/clanContext';
import { admit, doorStates, removedByStaff } from '@/lib/guestAdmission';
import { doorPolicy, mayJoinWith, tierOf } from '@/lib/characterState';
import { mayAddressClan } from '@/lib/clanAddress';
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
 * A character proved by the plugin or the XP check is granted the guest seat over `approval`
 * (lib/characterState doorPolicy), at a clan the person may address (lib/clanAddress). An unproven
 * one, and anyone at a members-only or hidden clan they have no tie to, gets the clan's own setting.
 *
 * Addressed by SLUG rather than by the clan prefix: /api/clans is a platform root, so this route is
 * reachable identically from the apex directory and from inside the clan's own pages.
 */

/** Which characters could apply, so the page can offer a choice before anyone presses anything. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await verifyUser();
  const clan = await resolveClanBySlug((await params).slug);
  if (!clan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!session?.playerId) return NextResponse.json({ signedIn: false, options: [] });

  // A typed name, checked as they type: is it on this clan's in-game member list? Then there is
  // nothing to apply for; the plugin recognises them. Signed-in people only, and throttled.
  const typed = validRsn(new URL(request.url).searchParams.get('rsn'));
  let named: { rsn: string; onRoster: boolean } | null = null;
  if (typed) {
    const peek = await rateLimitByKey('clan-apply-name', String(session.userId), { limit: 60, windowMs: 60_000 });
    if (peek.ok) named = { rsn: typed, onRoster: await onInGameList(clan.id, normalizeRsn(typed)) };
  }

  const { alreadyIn, options } = await applyChoices(clan.id, session.playerId);
  // Each character's standing at this door, so the page survives a reload: "asked" stays asked, and
  // a decline says so with its date instead of quietly offering the button again.
  const doors = await doorStates(clan.id, options.map((o) => o.id));

  return NextResponse.json({
    signedIn: true,
    guestPolicy: clan.guestPolicy,
    alreadyIn,
    named,
    // Applied with a name they have yet to prove (lib/applyIntents): shown as "applied", survives a reload.
    intent: await applyIntentOf(clan.id, session.playerId),
    options: options.map((o) => ({
      ...o,
      pending: doors.get(o.id)?.pending ?? false,
      declinedAt: doors.get(o.id)?.declinedAt ?? null,
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Not allowed from another site.' }, { status: 403 });
  }
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

  // APPLYING WITH A NAME (no character linked yet), confirming by the plugin or the XP check. Nothing
  // is granted and staff are asked nothing until the character is proved; then it goes through the
  // same door as below (lib/applyIntents).
  if (typeof body?.rsn === 'string' && body?.accountId == null) {
    const rsn = validRsn(body.rsn);
    if (!rsn) return NextResponse.json({ error: 'That is not an in-game name: 1 to 12 letters, numbers, spaces, hyphens or underscores.' }, { status: 400 });
    if (body.via !== 'plugin' && body.via !== 'xp') return NextResponse.json({ error: 'Choose how you will confirm the character.' }, { status: 400 });
    if (await isBannedFromClan(clan.id, session.playerId)) return NextResponse.json({ error: 'This clan has barred you.' }, { status: 403 });
    if (clan.guestPolicy === 'closed') return NextResponse.json({ error: 'This clan is not taking applications.' }, { status: 403 });
    const rsnNormalized = normalizeRsn(rsn);
    if (await claimBlockedBy(rsnNormalized, session.playerId)) {
      return NextResponse.json({ error: 'That character is already linked to someone else. If it is yours, claim it from Settings, under Characters.' }, { status: 409 });
    }
    // On the in-game list already: no application at all. The plugin's first report (or the XP
    // check) links the character and the member seat is theirs.
    if (await onInGameList(clan.id, rsnNormalized)) return NextResponse.json({ ok: true, onRoster: true, rsn });
    await fileApplyIntent({ clanId: clan.id, playerId: session.playerId, rsn, rsnNormalized, via: body.via });
    return NextResponse.json({ ok: true, applied: true, rsn, via: body.via }, { status: 202 });
  }

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
  if (!mayJoinWith(account)) {
    return NextResponse.json({ error: `${account.rsn} has to be verified first.` }, { status: 403 });
  }

  // A PROVEN character (plugin or XP check) is granted the guest seat at once, flagged for staff in
  // Needs review when it came by XP check, but only at a clan this person may address (lib/clanAddress).
  // At a members-only or hidden clan they have no tie to, and for a character that is only a claim
  // (asked staff to vouch), nothing is overridden: the clan's own guest setting decides. Closed clans
  // and bans are still refused inside admit(); a seat staff removed goes back to a request.
  const tier = tierOf(account);
  const mayAddress = await mayAddressClan({ clanId: clan.id, playerId: session.playerId, userId: session.userId, countRequests: tier === 'manual' });
  // An unproven claim at a clan that is not theirs to address: the same answer as no such clan
  // (the rule /api/auth/request-manual-review applies to the same person).
  if (tier === 'manual' && !mayAddress) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const typed = typeof body?.message === 'string' ? body.message.trim() : '';
  // Staff reading the queue are told when nothing proves the character yet.
  const message = tier === 'manual' ? `Asks staff to vouch for ${account.rsn} (no plugin or XP check).${typed ? ` ${typed}` : ''}` : typed || undefined;
  const admission = await admit({
    clanId: clan.id,
    accountId,
    source: 'web',
    message,
    policy: doorPolicy({ tier, mayAddress, removedByStaff: await removedByStaff(clan.id, accountId) }),
  });

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
