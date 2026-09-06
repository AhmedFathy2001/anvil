import { NextResponse } from 'next/server';

import { timingSafeStrEqual } from '@/lib/auth';
import { syncClanCommands } from '@/lib/discordCommandSync';
import { log } from '@/lib/logger';

// A couple of Discord REST calls — nothing that needs the long budget the sweeps do.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Keep Discord's copy of the slash-command tree in step with the code.
 *
 * Registration already happens on boot (instrumentation.ts), so this is the self-heal: a boot that
 * couldn't reach Discord, a command edited without a redeploy, or a set that drifted for any reason
 * is reconciled here. Same reconcile as boot — syncClanCommands, which registers `sharedBotToken()`'s
 * commands (global on the multi-clan platform). A full-set PUT, idempotent, so running it daily costs
 * one write and can only converge; global registration takes up to an hour, which is why daily is plenty.
 *
 * A deployment with no bot token reconciles nothing and 200s. Same Bearer-CRON_SECRET auth as the
 * other /api/cron jobs; called by deploy/cron/site-cron.sh.
 */
export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production' && !CRON_SECRET) {
    log.error('discord-commands-cron.misconfigured', { reason: 'CRON_SECRET env var is unset in production' });
    return NextResponse.json({ error: 'Server misconfigured: CRON_SECRET is required in production' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  const hasValidSecret = !!CRON_SECRET && timingSafeStrEqual(authHeader ?? '', `Bearer ${CRON_SECRET}`);
  const devBypass = !CRON_SECRET && request.headers.get('x-vercel-cron') === '1';
  if (!hasValidSecret && !devBypass) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await syncClanCommands();

  // No bot token is not a failure — a deployment with nothing to register 200s and cron stays quiet.
  // A real Discord failure 502s so the journal carries it.
  const benign = result.reason === 'no-bot-token' || result.reason === 'shared-bot';
  if (!result.ok && !benign) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 502 });
  }
  return NextResponse.json({ ok: true, scope: result.scope ?? null, count: result.count ?? 0, skipped: result.reason ?? null });
}
