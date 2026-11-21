import { NextResponse } from 'next/server';

import { verifyFeeCollector } from '@/lib/auth';
import { requireClan } from '@/lib/clanContext';
import { db } from '@/db';
import { clanRoster } from '@/db/schema';
import { rosterClanSeat } from '@/lib/seatScope';
import { and, eq, inArray } from 'drizzle-orm';
import { getCofferBalance, listCofferEntries, recordAdjustment, recordDonations } from '@/lib/coffer';
import { refuseForCreatorSpace } from '@/lib/creatorGuard';
import { getSetting, setSetting } from '@/lib/settings';
import { HCW_COFFER_SETTING_KEY, type PrizeCurrency } from '@/lib/competitionGame';

/**
 * The staff side of the coffer: the whole ledger, and the one write that isn't a reaction to
 * somebody else — a manual adjustment.
 *
 * Gated on the same grant that collects sign-up fees (treasurer or admin, never a plain moderator),
 * because it is the same job: this is the clan's money, and rank alone has never conferred it.
 */

async function hcwCofferOn(clanId: number): Promise<boolean> {
  return (await getSetting(clanId, HCW_COFFER_SETTING_KEY)) === '1';
}

/**
 * Which pot a request is about. 'hcw' only while the clan keeps a Hardcore Worlds coffer: switched
 * off, that pot is hidden everywhere, so nothing should be able to write to it either.
 */
async function pickPot(clanId: number, raw: unknown): Promise<{ pot: PrizeCurrency } | { refused: NextResponse }> {
  if (raw == null || raw === '' || raw === 'gp') return { pot: 'gp' };
  if (raw !== 'hcw') return { refused: NextResponse.json({ error: 'Unknown coffer.' }, { status: 400 }) };
  if (!(await hcwCofferOn(clanId))) {
    return { refused: NextResponse.json({ error: 'This clan does not keep a Hardcore Worlds coffer.' }, { status: 400 }) };
  }
  return { pot: 'hcw' };
}

export async function GET(request: Request) {
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const picked = await pickPot(clan.id, new URL(request.url).searchParams.get('currency'));
  if ('refused' in picked) return picked.refused;
  const [balance, entries] = await Promise.all([
    getCofferBalance(clan.id, picked.pot),
    listCofferEntries({ clanId: clan.id, limit: 200, currency: picked.pot }),
  ]);
  return NextResponse.json({ balance, entries, currency: picked.pot });
}

/**
 * Switching the Hardcore Worlds coffer on or off. Off only hides it: the pot's rows stay, so
 * turning it back on finds the same balance.
 */
export async function PUT(request: Request) {
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();
  const body = (await request.json().catch(() => null)) as { hcwCoffer?: unknown } | null;
  if (typeof body?.hcwCoffer !== 'boolean') {
    return NextResponse.json({ error: 'Say whether to keep a Hardcore Worlds coffer.' }, { status: 400 });
  }
  await setSetting(clan.id, HCW_COFFER_SETTING_KEY, body.hcwCoffer ? '1' : '0');
  return NextResponse.json({ hcwCoffer: body.hcwCoffer });
}

export async function POST(request: Request) {
  // In-game clans only: a creator space has no roster, weeklies or coffer (lib/creatorGuard).
  const notForCreators = await refuseForCreatorSpace();
  if (notForCreators) return notForCreators;
  const session = await verifyFeeCollector();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const clan = await requireClan();

  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    note?: unknown;
    donors?: unknown;
    force?: unknown;
    currency?: unknown;
  } | null;
  const picked = await pickPot(clan.id, body?.currency);
  if ('refused' in picked) return picked.refused;
  const currency = picked.pot;

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
        // An event player's seat is not on the roster — the coffer credits clan seats only.
        .where(and(eq(clanRoster.clanId, clan.id), inArray(clanRoster.id, ids), rosterClanSeat()));
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
      currency,
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
  // THE POT DOES NOT GO BELOW ZERO on its own. It used to: a negative adjustment could spend gp that
  // was already promised to a live board or an unpaid winner, and the ledger said nothing.
  //
  // But reality wins over the ledger — gp really can leave in game before anybody writes it down —
  // so `force` records it anyway. The refusal carries the balance it would leave, which is what the
  // page turns into a confirmation: a treasurer approves the number rather than being told no.
  const result = await recordAdjustment({
    clanId: clan.id,
    amount,
    userId: session.userId,
    note: typeof body?.note === 'string' ? body.note.slice(0, 500) : null,
    force: body?.force === true,
    currency,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, wouldLeave: result.wouldLeave, needsConfirm: true },
      { status: 409 },
    );
  }
  return NextResponse.json({ entry: result.entry });
}
