import { after, NextResponse } from 'next/server';

import { answerKickJoin } from '@/lib/gates/kickChat';
import { handleKickWebhook } from '@/lib/gates/kickWebhook';
import { log } from '@/lib/logger';

// RSA verification and Buffer — Node runtime.
export const runtime = 'nodejs';

// POST /api/webhooks/kick — Kick's event webhook (the "Webhook URL" in the Kick app's settings).
// Verified and applied by lib/gates/kickWebhook; a `!join` reply is sent after the response so the
// webhook answers Kick at once (Kick disables a webhook that keeps failing for a day).
export async function POST(request: Request) {
  const raw = await request.text();
  const r = await handleKickWebhook(request.headers, raw);
  if (r.after) {
    const job = r.after;
    const send = () => answerKickJoin({ clanId: job.clanId, broadcasterId: job.broadcasterId, replyTo: job.replyTo }).then(() => undefined);
    try {
      after(send);
    } catch {
      // Outside a request scope (never in production): fire and forget.
      void send().catch((err: Error) => log.warn('kick.join-failed', {}, err));
    }
  }
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
