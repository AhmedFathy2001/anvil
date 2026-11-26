import { NextResponse } from 'next/server';
import { serverInfo } from '@/lib/serverInfo';
import { tripRegions } from '@/lib/guideAreas';
import { regionIds, tripNamesOf } from '@/lib/tripContent';

// Public deployment identity: semver, git SHA, and the plugin-API contract this instance speaks.
// Lets self-host operators, the control plane, and support answer "what is this clan running?"
// without shell access. No auth — everything here is already visible in the footer. The one read is
// the trip regions (lib/guideAreas), cached and time-boxed with a built-in fallback, so a slow or
// down database can't fail the deploy health gate that polls this.
//
// force-dynamic: GIT_SHA is a runtime env (Dockerfile ARG→ENV); a build-time static render would
// bake 'dev' in, since `next build` runs in the builder stage before the ARG-carrying runner exists.
export const dynamic = 'force-dynamic';

export async function GET() {
  // tripRegions: the pre-trip check's banks and lobbies (capability 'trip-check'), for a plugin whose
  // person is in no clan and so gets no /api/plugin/config to read them from.
  const regions = await tripRegions();
  return NextResponse.json({ name: 'anvil', ...serverInfo(), tripRegions: regionIds(regions), tripNames: tripNamesOf(regions) });
}
