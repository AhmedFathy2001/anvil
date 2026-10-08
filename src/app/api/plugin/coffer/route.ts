import { NextResponse } from 'next/server';

import { resolvePluginMember } from '@/lib/auth';
import { announceCofferMovement } from '@/lib/cofferFeed';
import { getCofferBalance } from '@/lib/coffer';
import { syncPhysicalCoffer } from '@/lib/cofferSync';
import type { CofferObservationKind } from '@/lib/cofferSyncDecision';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';

const MAX_GP = 2_147_483_647;
const KINDS = new Set<CofferObservationKind>(['snapshot', 'deposit', 'withdrawal']);

function balance(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_GP
    ? value
    : null;
}

/** Receive a balance transition read directly from the in-game Clan Coffer interface. */
export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' },
      { status: 401 },
    );
  }

  const rl = await rateLimit(request, `plugin-coffer:${member.userId}`, { limit: 40, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rateLimitHeaders(rl) });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const kind = typeof body.kind === 'string' && KINDS.has(body.kind as CofferObservationKind)
    ? body.kind as CofferObservationKind
    : null;
  const beforeBalance = balance(body.beforeBalance);
  const afterBalance = balance(body.afterBalance);
  const eventKey = typeof body.eventKey === 'string' ? body.eventKey.trim() : '';
  if (!kind || beforeBalance == null || afterBalance == null || !/^[a-zA-Z0-9-]{8,100}$/.test(eventKey)) {
    return NextResponse.json({ error: 'kind, beforeBalance, afterBalance and eventKey are required' }, { status: 400 });
  }
  if (kind === 'snapshot' && beforeBalance !== afterBalance) {
    return NextResponse.json({ error: 'A snapshot must have the same before and after balance' }, { status: 400 });
  }
  if (kind === 'deposit' && afterBalance <= beforeBalance) {
    return NextResponse.json({ error: 'A deposit must increase the balance' }, { status: 400 });
  }
  if (kind === 'withdrawal' && afterBalance >= beforeBalance) {
    return NextResponse.json({ error: 'A withdrawal must decrease the balance' }, { status: 400 });
  }

  const result = await syncPhysicalCoffer({
    clanId: member.clanId,
    clanMemberId: member.clanMemberId,
    userId: member.userId,
    rsn: member.rsn,
    eventKey,
    kind,
    beforeBalance,
    afterBalance,
    actorConfirmed: body.actorConfirmed === true,
    pluginVersion: request.headers.get('X-Anvil-Plugin-Version')?.slice(0, 40) ?? null,
  });

  if (result.ledgerEntry) {
    void getCofferBalance(member.clanId)
      .then((b) => announceCofferMovement(member.clanId, result.ledgerEntry!, b.available))
      .catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    duplicate: result.duplicateEvent,
    outcome: result.outcome,
    amount: result.amount,
    balance: result.balance,
  });
}

