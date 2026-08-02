import { NextResponse } from 'next/server';
import { serverInfo } from '@/lib/serverInfo';

// Public deployment identity: semver, git SHA, and the plugin-API contract this instance speaks.
// Lets self-host operators, the control plane, and support answer "what is this clan running?"
// without shell access. No DB touch, no auth — everything here is already visible in the footer.
//
// force-dynamic: GIT_SHA is a runtime env (Dockerfile ARG→ENV); a build-time static render would
// bake 'dev' in, since `next build` runs in the builder stage before the ARG-carrying runner exists.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ name: 'anvil', ...serverInfo() });
}
