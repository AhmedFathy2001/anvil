import { NextResponse } from 'next/server';
import { desc, inArray } from 'drizzle-orm';

import { db } from '@/db';
import { clanAuditLog, gearDatasets } from '@/db/schema';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { fetchGearDataset } from '@/lib/dps/wikiDataset';
import { invalidateGear } from '@/lib/dps/store';
import { log } from '@/lib/logger';

// A wiki refresh takes ~20–40 s (a dozen paged Bucket queries).
export const maxDuration = 120;

/** Fewer than this and the wiki answered badly — keep what we have rather than wipe the calculator. */
const MIN_ITEMS = 1000;
const MIN_MONSTERS = 1000;
const KEEP = 3;

// POST — pull items and monsters from the wiki now, for a new boss or weapon, without a deploy.
export async function POST() {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  let data;
  try {
    data = await fetchGearDataset();
  } catch (err) {
    log.warn('gear.refresh-fail', { err: String(err) });
    return NextResponse.json({ error: `The wiki didn't answer: ${String(err).slice(0, 200)}` }, { status: 502 });
  }
  if (data.items.length < MIN_ITEMS || data.monsters.length < MIN_MONSTERS) {
    return NextResponse.json(
      { error: `The wiki returned only ${data.items.length} items and ${data.monsters.length} monsters — kept the current data.` },
      { status: 502 },
    );
  }
  const [row] = await db
    .insert(gearDatasets)
    .values({
      items: data.items,
      monsters: data.monsters,
      itemCount: data.items.length,
      monsterCount: data.monsters.length,
      createdByUserId: gate.actor.user.userId,
      createdAt: new Date().toISOString(),
    })
    .returning({ id: gearDatasets.id });
  // Keep a few for rollback; each is ~1 MB of JSON.
  const old = (await db.select({ id: gearDatasets.id }).from(gearDatasets).orderBy(desc(gearDatasets.id))).slice(KEEP);
  if (old.length) await db.delete(gearDatasets).where(inArray(gearDatasets.id, old.map((o) => o.id)));
  await db
    .insert(clanAuditLog)
    .values({ clanId: null, eventType: 'gear_dataset_refreshed', actorUserId: gate.actor.user.userId, newValue: JSON.stringify({ id: row.id, items: data.items.length, monsters: data.monsters.length }) })
    .catch(() => {});
  invalidateGear();
  return NextResponse.json({ ok: true, id: row.id, items: data.items.length, monsters: data.monsters.length });
}
