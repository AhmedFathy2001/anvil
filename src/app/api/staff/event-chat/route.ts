import { NextResponse } from 'next/server';

import { platformChatOn, setPlatformChat } from '@/lib/eventChat';
import { CAN_WRITE, requirePlatformApi } from '@/lib/platformAccess';

export const dynamic = 'force-dynamic';

// The platform switch for every event chat (lib/eventChat): off here closes the Feed tab's chat on
// every board at once, whatever each host chose.

export async function GET() {
  const gate = await requirePlatformApi();
  if ('response' in gate) return gate.response;
  return NextResponse.json({ enabled: await platformChatOn(true) });
}

// PUT /api/staff/event-chat — { enabled: boolean }
export async function PUT(request: Request) {
  const gate = await requirePlatformApi(CAN_WRITE);
  if ('response' in gate) return gate.response;
  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== 'boolean') return NextResponse.json({ error: 'Expected { enabled: boolean }' }, { status: 400 });
  await setPlatformChat(body.enabled);
  return NextResponse.json({ enabled: body.enabled });
}
