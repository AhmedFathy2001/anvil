import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { announceDeploy } from '@/lib/deployNotify';

export const runtime = 'nodejs';

/**
 * Authorize CI with a shared bearer secret, timing-safe — the same shape the cron dispatch uses.
 *
 * ROLLOUT_SECRET keeps its name on purpose: it is already a repo secret and already in this app's
 * env, so renaming it would mean a coordinated change across GitHub and the box to buy nothing.
 */
function authorized(req: NextRequest): boolean {
  const secret = process.env.ROLLOUT_SECRET;
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!secret || !token) return false;
  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * "A deploy finished" — called by CI once the new build is confirmed serving.
 *
 * This replaces /api/admin/rollout, which CI has been posting to since the migration and which has
 * answered 404 every time: it lived in the control plane, and a rollout meant recreating one
 * container per clan. There is one deployment now, so there is nothing here to orchestrate — by the
 * time this is called the new build is already answering, health-gated on its own commit SHA. All
 * that is left is to say so.
 *
 * The webhook is read from this app's env rather than passed in, so a Discord URL never has to live
 * in a CI secret. An unset webhook is reported, not an error: a deploy that worked must not report
 * as failed because nobody has configured anywhere to announce it.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 });

  const body = await req.json().catch(() => ({}));
  const notice = {
    version: typeof body.version === 'string' ? body.version : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
    channel: typeof body.channel === 'string' ? body.channel : undefined,
    sha: typeof body.sha === 'string' ? body.sha : undefined,
  };

  const announced = await announceDeploy(notice);
  console.log(JSON.stringify({ evt: 'deploy-notify', channel: notice.channel, sha: notice.sha, announced }));
  return Response.json({ ok: true, announced }, { status: 200 });
}
