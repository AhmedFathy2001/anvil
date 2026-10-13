import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import {
  accountBelongsToPerson,
  emissionSettingsView,
  isValidEmissionTarget,
  setAccountClanEmission,
  type EmissionState,
} from '@/lib/emissionSettings';
import { isLevelPostsChoice, normalizeMilestoneRules } from '@/lib/levelRules';

export const dynamic = 'force-dynamic';

/**
 * A person's own emission settings — the /profile controls behind lib/emissionRouting.
 *
 * PLATFORM, not clan: these belong to the human and follow them between clans, so they key on the
 * login and never read a Host. Every write is scoped to the caller's own person; there is no shape of
 * request that touches someone else's.
 */
export async function GET() {
  const session = await verifyUser();
  if (!session?.userId || session.playerId == null) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  return NextResponse.json(await emissionSettingsView(session.userId, session.playerId));
}

export async function PATCH(request: Request) {
  const session = await verifyUser();
  if (!session?.userId || session.playerId == null) {
    return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  }

  // The user-level "block emitting to guest clans" toggle.
  if ('blockGuestEmissions' in body) {
    await db
      .update(users)
      .set({ blockGuestEmissions: Boolean(body.blockGuestEmissions) })
      .where(eq(users.id, session.userId));
    return NextResponse.json(await emissionSettingsView(session.userId, session.playerId));
  }

  // Level posts in clan channels (lib/levelRules): clan | ninetyNinesAndMax | off. Stricter only —
  // the effective rules are computed from the clan's, so no value here can add a post.
  if ('levelPostsClan' in body) {
    if (!isLevelPostsChoice(body.levelPostsClan)) {
      return NextResponse.json({ error: 'levelPostsClan must be clan | ninetyNinesAndMax | off' }, { status: 400 });
    }
    await db.update(users).set({ levelPostsClan: body.levelPostsClan }).where(eq(users.id, session.userId));
    return NextResponse.json(await emissionSettingsView(session.userId, session.playerId));
  }

  // Level / XP rules for the person's own webhooks. Normalised (clamped, defaults for missing fields).
  if ('personalLevelRules' in body) {
    const rules = body.personalLevelRules == null ? null : JSON.stringify(normalizeMilestoneRules(body.personalLevelRules));
    await db.update(users).set({ levelRules: rules }).where(eq(users.id, session.userId));
    return NextResponse.json(await emissionSettingsView(session.userId, session.playerId));
  }

  // A per-(account, clan) override: default | always | never.
  if ('accountId' in body && 'clanId' in body) {
    const accountId = Number(body.accountId);
    const clanId = Number(body.clanId);
    const state = String(body.state) as EmissionState;
    if (!['default', 'always', 'never'].includes(state)) {
      return NextResponse.json({ error: 'state must be default | always | never' }, { status: 400 });
    }
    if (!(await accountBelongsToPerson(accountId, session.playerId))) {
      return NextResponse.json({ error: 'Not your account.' }, { status: 403 });
    }
    // Refuse pointing an account at a clan it has no connection to — a seat of its own, or a clan
    // its owner is a member of. Clearing (default) is always allowed.
    if (state !== 'default' && !(await isValidEmissionTarget(accountId, clanId, session.playerId))) {
      return NextResponse.json(
        { error: 'You can only allow a clan this account plays in, or one you are a member of.' },
        { status: 400 },
      );
    }
    await setAccountClanEmission(accountId, clanId, state);
    return NextResponse.json(await emissionSettingsView(session.userId, session.playerId));
  }

  return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });
}
