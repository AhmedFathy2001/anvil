import { NextResponse } from 'next/server';

import { requireClan } from '@/lib/clanContext';
import { verifyAdminOrModerator } from '@/lib/auth';
import { getSetting, setSetting } from '@/lib/settings';
import { SNOOZE_SETTING_KEY, MAX_SNOOZE_DAYS, parseSnoozes } from '@/lib/adminSnooze';

/**
 * "Yes, I know" — putting one dashboard item down for a while.
 *
 * PER CLAN, NOT PER PERSON. Staff share this work: one of them deciding the fees left over from the
 * July board can wait a fortnight is a decision about the clan's queue, not a preference in their
 * browser. It is also why this is a server call rather than localStorage — the next mod to open the
 * dashboard should see the same answer.
 *
 * Moderator-tier, because the items that can be snoozed are moderator work. Nothing here can hide a
 * board that opens on Friday with no teams: `snoozable` is decided in lib/adminAttention, and a
 * stored key for an item that is not snoozable is simply ignored when the queue is built.
 */
export async function POST(request: Request) {
  const user = await verifyAdminOrModerator();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clan = await requireClan();
  const { key, days } = await request.json().catch(() => ({}));

  if (typeof key !== 'string' || !key || key.length > 64) {
    return NextResponse.json({ error: 'Which item?' }, { status: 400 });
  }

  const current = parseSnoozes(await getSetting(clan.id, SNOOZE_SETTING_KEY));

  // days: 0 (or absent) wakes it back up. Anything else is clamped — a snooze measured in months is
  // a decision to stop tracking the thing, and this is not the control for that.
  const requested = Number(days);
  if (!Number.isFinite(requested) || requested <= 0) {
    delete current[key];
  } else {
    const capped = Math.min(Math.ceil(requested), MAX_SNOOZE_DAYS);
    current[key] = Date.now() + capped * 86_400_000;
  }

  await setSetting(clan.id, SNOOZE_SETTING_KEY, JSON.stringify(current));
  return NextResponse.json({ ok: true, snoozed: current });
}
