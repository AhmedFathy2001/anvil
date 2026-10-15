import { existsSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { GIT_SHA } from '@/lib/serverInfo';

// Load-balancer health: is THIS container taking new requests?
//
// Caddy lists both blue-green slots of a channel and active-checks this path on each. It answers
// 503 once deploy.sh has marked the container as draining (it touches the file below with
// `docker exec` before stopping it), so Caddy stops picking the old slot BEFORE it is sent SIGTERM.
// Without that step the only signal Caddy gets is the closing socket, and a request that lands on a
// pooled keep-alive connection at that same moment can fail.
//
// /api/version cannot do this job. It is the public deployment identity that plugins and humans
// read, and it has to keep answering 200 the same way while a container drains.
//
// No DB touch, on purpose: a Postgres blip must not get both slots taken out of rotation together.
export const dynamic = 'force-dynamic';

const DRAIN_FILE = process.env.DRAIN_FILE || '/tmp/anvil-draining';

export async function GET() {
  const draining = existsSync(DRAIN_FILE);
  return NextResponse.json(
    { ok: !draining, draining, sha: GIT_SHA },
    { status: draining ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
