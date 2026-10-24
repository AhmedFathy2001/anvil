import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';

import { db } from '@/db';
import { labScenarios } from '@/db/schema';
import { verifyPluginTokenUser } from '@/lib/auth';
import { platformRoleOf } from '@/lib/clanGrants';
import { hasPlatformRole } from '@/lib/clanRoles';
import { CAN_WRITE } from '@/lib/platformAccess';

// GET /api/plugin/lab/scenarios — the replay scenarios authored on /staff/lab, for the plugin's
// dev-client test harness (`::anvil sync`, capability 'lab-scenarios'). The hub plugin never calls it.
//
// Platform staff only, by the plugin token's user, read live like every platform check. A scenario
// is a script that makes a client believe a pet dropped; it is not something to hand any token.
export async function GET(request: Request) {
  const user = await verifyPluginTokenUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasPlatformRole(await platformRoleOf(user.userId), CAN_WRITE)) {
    return NextResponse.json({ error: 'Platform staff only' }, { status: 403 });
  }
  const rows = await db
    .select({ name: labScenarios.name, description: labScenarios.description, params: labScenarios.params, steps: labScenarios.steps })
    .from(labScenarios)
    .orderBy(asc(labScenarios.name));
  return NextResponse.json({ scenarios: rows });
}
