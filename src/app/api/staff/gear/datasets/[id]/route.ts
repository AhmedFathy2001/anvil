import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { gearDatasets } from '@/db/schema';
import { requireLibraryEditorApi } from '@/lib/guideAccess';
import { invalidateGear } from '@/lib/dps/store';

// DELETE — roll back a refresh: the next newest (or the bundled data) takes over.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireLibraryEditorApi();
  if ('response' in gate) return gate.response;
  await db.delete(gearDatasets).where(eq(gearDatasets.id, Number((await params).id)));
  invalidateGear();
  return NextResponse.json({ ok: true });
}
