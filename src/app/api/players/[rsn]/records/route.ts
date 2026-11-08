import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { users } from '@/db/schema';
import { apexCharacter } from '@/lib/apexProfiles';
import { verifyPluginTokenUser } from '@/lib/auth';
import { jsonWithEtag } from '@/lib/httpEtag';
import { getAccountRecords } from '@/lib/records';
import { RECORD_PERIODS } from '@/lib/recordsRules';

/**
 * A character's records — best gain per skill / boss / hours metric in a day, week, month and
 * year: GET /api/players/<rsn>/records. For the plugin panel and anything else that wants them.
 *
 * Same visibility as the player card (apexCharacter): shared characters are anyone's to look at, an
 * unshared one only its owner's (via the plugin token).
 *
 *   → { rsn, periods: ['day','week','month','year'], records: [{ metric, period, value, startedAt, endedAt }] }
 *
 * Skills are XP, bosses are kills, `hours_played` / `hours_bossed` are hours. Records start when
 * Anvil began tracking them; there is no history before that.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ rsn: string }> }) {
  const rsn = decodeURIComponent((await params).rsn).trim();
  if (!rsn || rsn.length > 12) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let viewerPlayerId: number | null = null;
  const viewer = await verifyPluginTokenUser(request);
  if (viewer) {
    const row = await db.query.users.findFirst({ where: eq(users.id, viewer.userId), columns: { playerId: true } });
    viewerPlayerId = row?.playerId ?? null;
  }

  const character = await apexCharacter(rsn, viewerPlayerId);
  if (!character) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const records = await getAccountRecords(character.accountId);
  return jsonWithEtag(request, { rsn: character.rsn, periods: RECORD_PERIODS, records });
}
