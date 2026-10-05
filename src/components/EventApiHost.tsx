'use client';

import { registerEventApiPrefix } from '@/lib/clanFetch';

/**
 * Sends this event's API calls to its HOST's address while the page sits at a co-host's.
 *
 * Rendered by a participant page only when it was reached through a co-host (see lib/eventScope
 * `requireEventForParticipantPage`). Registers during render rather than in an effect: the
 * registration has to be in place before any child's effect fires its first fetch, and it is an
 * idempotent write to a module map, which is safe to repeat.
 */
export default function EventApiHost({ eventId, prefix }: { eventId: number; prefix: string | null }) {
  if (prefix && typeof window !== 'undefined') registerEventApiPrefix(eventId, prefix);
  return null;
}
