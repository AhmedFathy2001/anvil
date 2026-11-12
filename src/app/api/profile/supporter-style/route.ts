import { and, eq, ne, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { verifyUser } from '@/lib/auth';
import { distinctStaticColours, parseSupporterStyle, supporterForUser, SUPPORTER_TIERS, tryTier, validateSupporterStyle, type SupporterTierId } from '@/lib/supporter';

export const dynamic = 'force-dynamic';

// Your Supporter name colours (lib/supporterStyle): a preset for a Champion, a preset or your own
// stops for a Patron. Checked against the tier in force NOW, whatever the picker in the browser
// allowed; the answer is the style as it will be worn everywhere (site, plugin panel, Discord).
//
// TRY BEFORE YOU SUBSCRIBE: `as` (a tier id) checks the look against that tier instead, when it is
// above the one held, so anyone can save the look a tier would give them. It is only stored: every
// read gates it by the tier in force (effectiveSupporterStyle; no subscription = no flair at all),
// so nobody else sees it until they hold that tier, and subscribing wears it at once.

export async function PUT(request: Request) {
  const session = await verifyUser();
  if (!session?.userId) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  const body = await request.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ error: 'Bad body' }, { status: 400 });
  const supporter = await supporterForUser(session.userId);
  const payload = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const accountId = typeof payload?.accountId === 'number' && Number.isInteger(payload.accountId) ? payload.accountId : null;
  const allCharacters = payload?.allCharacters === true;
  // `as` rides beside the style; the Anvil-name form sends the style itself as the body.
  const askedRaw = typeof payload?.as === 'string' ? payload.as : null;
  const asked = askedRaw && Object.hasOwn(SUPPORTER_TIERS, askedRaw) ? (askedRaw as SupporterTierId) : null;
  const held = supporter?.tier.id ?? null;
  const tier = tryTier(held, asked);
  const trying = tier !== held;
  // (An `as` key beside an Anvil-name style is ignored by the check: it reads only the look's fields.)
  const requested = accountId == null ? body : payload?.style;
  const check = validateSupporterStyle(requested, tier, { keepDefault: trying });
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  if (accountId != null) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, session.userId), columns: { playerId: true } });
    if (!owner?.playerId) return NextResponse.json({ error: 'Link a character first.' }, { status: 409 });
    const playerId = owner.playerId;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${playerId})`);
      const [account] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.id, accountId), eq(accounts.playerId, playerId)))
        .limit(1);
      if (!account) return { error: 'That character is not yours.', status: 404 } as const;
      if (tier === 'champion' && !allCharacters) {
        const rows = await tx
          .select({ style: accounts.supporterStyle })
          .from(accounts)
          .where(and(eq(accounts.playerId, playerId), ne(accounts.id, accountId)));
        const colours = distinctStaticColours([
          ...rows.map((row) => parseSupporterStyle(row.style) ?? supporter?.style ?? null),
          check.style ?? supporter?.style ?? null,
        ]);
        if (colours.size > 2) return { error: 'Champions may use at most two custom colours across their characters.', status: 400 } as const;
      }
      await tx.update(accounts).set({ supporterStyle: check.style ? JSON.stringify(check.style) : null }).where(
        allCharacters ? eq(accounts.playerId, playerId) : eq(accounts.id, accountId),
      );
      return { ok: true } as const;
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ accountId, allCharacters, style: check.style, tier: held, trying });
  }
  await db
    .update(users)
    .set({ supporterStyle: check.style ? JSON.stringify(check.style) : null })
    .where(eq(users.id, session.userId));
  return NextResponse.json({ style: check.style, tier: held, trying });
}
