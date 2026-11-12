import { NextResponse } from 'next/server';

import { relayOn, setRelayOn } from '@/lib/chatRelay';
import { platformChatOn, setPlatformChat } from '@/lib/eventChat';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

export const dynamic = 'force-dynamic';

// The platform switch for every event chat (lib/eventChat): off here closes the Feed tab's chat on
// every board at once, whatever each host chose. `relay`: the in-game chat relay's switch (lib/chatRelay).

export async function GET() {
  const gate = await requirePlatformApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json({ enabled: await platformChatOn(true), relay: await relayOn(true) });
}

// PUT /api/staff/event-chat — { enabled: boolean } or { relay: boolean }
export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { enabled?: unknown; relay?: unknown } | null;
  if (typeof body?.relay === 'boolean') {
    await setRelayOn(body.relay);
    return NextResponse.json({ relay: body.relay });
  }
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Expected { enabled: boolean }' }, { status: 400 });
  await setPlatformChat(body.enabled);
  return NextResponse.json({ enabled: body.enabled });
}
