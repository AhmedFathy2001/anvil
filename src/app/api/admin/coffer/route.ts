import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { clanRoster } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { getCofferBalance, listCofferEntries, recordAdjustment, recordDonations } from '@/lib/coffer';

/**
 * The staff side of the coffer: the whole ledger, and the one write that isn't a reaction to
 * somebody else — a manual adjustment.
 *
 * Gated on the same grant that collects sign-up fees (treasurer or admin, never a plain moderator),
 * because it is the same job: this is the clan's money, and rank alone has never conferred it.
 */

export async function GET() {
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const [balance, entries] = await Promise.all([
    getCofferBalance(clan.id),
    listCofferEntries({ clanId: clan.id, limit: 200 }),
  ]);
  return NextResponse.json({ balance, entries });
}

export async function POST(request: Request) {
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();

  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    note?: unknown;
    donors?: unknown;
  } | null;

  // Named donors: a gift the treasurer is recording on somebody's behalf, one row each so the
  // top-donor list can thank them individually. Everything below stays the anonymous movement.
  if (Array.isArray(body?.donors) && body.donors.length > 0) {
    const donors = body.donors
      .map((d) => d as { clanMemberId?: unknown; rsn?: unknown; amount?: unknown })
      .map((d) => ({
        clanMemberId: Number.isFinite(Number(d.clanMemberId)) ? Number(d.clanMemberId) : null,
        rsn: typeof d.rsn === 'string' && d.rsn.trim() ? d.rsn.trim().slice(0, 32) : null,
        amount: Math.floor(Number(d.amount)),
      }))
      .filter((d) => Number.isFinite(d.amount) && d.amount > 0);
    if (donors.length === 0) {
      return NextResponse.json({ error: 'Give each donor an amount.' }, { status: 400 });
    }
    if (donors.length > 50) {
      return NextResponse.json({ error: 'That is more donors than one entry can hold.' }, { status: 400 });
    }
    const total = donors.reduce((sum, d) => sum + d.amount, 0);
    if (total > 100_000_000_000) {
      return NextResponse.json({ error: 'That amount is out of range.' }, { status: 400 });
    }
    // Every donor must be on THIS clan's roster. A seat id is just a number, and crediting one from
    // another clan's roster would put a stranger's name on this clan's thank-you list.
    const ids = donors.map((d) => d.clanMemberId).filter((id): id is number => id != null);
    if (ids.length > 0) {
      const seats = await db
        .select({ id: clanRoster.id })
        .from(clanRoster)
        .where(and(eq(clanRoster.clanId, clan.id), inArray(clanRoster.id, ids)));
      const mine = new Set(seats.map((s) => s.id));
      if (ids.some((id) => !mine.has(id))) {
        return NextResponse.json({ error: 'One of those members is not on your roster.' }, { status: 400 });
      }
    }
    const entries = await recordDonations({
      clanId: clan.id,
      donors,
      userId: session.userId,
      note: typeof body.note === 'string' ? body.note.slice(0, 500) : null,
    });
    return NextResponse.json({ entries });
  }

  const amount = Math.trunc(Number(body?.amount));
  if (!Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: 'Enter an amount to add or remove.' }, { status: 400 });
  }
  if (Math.abs(amount) > 100_000_000_000) {
    return NextResponse.json({ error: 'That amount is out of range.' }, { status: 400 });
  }
  // A negative adjustment can take the pot below what is already promised, and that is allowed on
  // purpose: the gp really did leave, and a ledger that refuses to record reality is worth less than
  // one that shows a treasurer they are short.
  const entry = await recordAdjustment({
    clanId: clan.id,
    amount,
    userId: session.userId,
    note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null,
  });
  return NextResponse.json({ entry });
}
