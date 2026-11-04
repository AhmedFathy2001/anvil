import { NextResponse } from 'next/server';

import { verifyUser } from '@/lib/auth';
import { gateCache, gatesForEvent } from '@/lib/entryGatesDb';
import { checkChatCode, type ChatCheck } from '@/lib/gates/youtubeDb';
import { rateLimitByKey } from '@/lib/rate-limit';

/** What the join card says for each result. Fixed words; the code itself is shown by the card. */
const MESSAGES: Record<ChatCheck, string> = {
  member: 'Membership confirmed. Press Join.',
  'not-member': 'We saw your code, but that YouTube account isn’t a channel member.',
  'not-seen': 'We didn’t see your code in the live chat yet. Send it, wait a few seconds, then check again.',
  offline: 'The host isn’t live on YouTube right now. The member check only works during a stream.',
  'host-missing': 'The host’s YouTube connection isn’t working — let them know.',
  off: 'YouTube checks aren’t available on this server.',
  error: 'YouTube didn’t answer just now. Try again in a minute.',
};

/**
 * POST /api/events/[eventId]/gate/youtube-chat — "I typed my code in the live chat, check it".
 *
 * Only for a creator-space event that has a YouTube member rule. Each press costs YouTube quota
 * (lib/gates/youtubeDb shares reads between viewers), so presses are rate-limited per person.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await verifyUser();
  if (!session) return NextResponse.json({ error: 'Sign in first' }, { status: 401 });

  const eventId = Number((await params).eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return NextResponse.json({ error: 'Bad event' }, { status: 400 });

  const limited = await rateLimitByKey('youtube-chat-check', String(session.userId), { limit: 6, windowMs: 60_000 });
  if (!limited.ok) return NextResponse.json({ error: 'Give it a few seconds, then check again.' }, { status: 429 });

  const g = await gatesForEvent(eventId);
  if (!g || !g.gates.anyOf.some((r) => r.kind === 'youtube-member')) {
    return NextResponse.json({ error: 'This event has no YouTube member check.' }, { status: 404 });
  }

  const result = await checkChatCode({ clanId: g.clanId, userId: session.userId });
  if (result === 'member' || result === 'not-member') gateCache.forgetUser(session.userId);
  return NextResponse.json({ result, ok: result === 'member', message: MESSAGES[result] });
}
