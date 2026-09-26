import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';

import { db } from '@/db';
import { gearDatasets, gearOverrides } from '@/db/schema';
import { libraryActor } from '@/lib/guideAccess';
import { effectiveGear } from '@/lib/dps/store';

// GET — where the calculator's data comes from, every platform override, and the refresh history.
export async function GET() {
  const actor = await libraryActor();
  if (!actor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [{ source }, overrides, datasets] = await Promise.all([
    effectiveGear(),
    db.select().from(gearOverrides).orderBy(desc(gearOverrides.updatedAt)),
    db
      .select({ id: gearDatasets.id, createdAt: gearDatasets.createdAt, itemCount: gearDatasets.itemCount, monsterCount: gearDatasets.monsterCount })
      .from(gearDatasets)
      .orderBy(desc(gearDatasets.id)),
  ]);
  return NextResponse.json({ canEdit: actor.canEdit, source, overrides, datasets });
}
