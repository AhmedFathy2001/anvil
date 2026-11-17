import { count, eq } from 'drizzle-orm';

import ClanLink from '@/components/ClanLink';
import { db } from '@/db';
import { accounts } from '@/db/schema';
import { verifyUser } from '@/lib/auth';

/**
 * A new owner has no character, so they cannot play the event they just made. Offered, never a
 * blocker: nothing on this page waits for it. Links the character card the sign-up page also uses.
 */
export default async function OwnCharacterNudge({ eventId }: { eventId: number }) {
  const me = await verifyUser();
  if (!me) return null;
  if (me.playerId != null) {
    const [n] = await db.select({ c: count() }).from(accounts).where(eq(accounts.playerId, me.playerId));
    if ((n?.c ?? 0) > 0) return null;
  }
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-card-border bg-card-bg p-4 text-sm">
      <div>
        <div className="font-semibold">Want to play your own event?</div>
        <p className="mt-0.5 text-text-muted">You have no character on Anvil yet. Add one whenever you like; nothing here waits for it.</p>
      </div>
      <div className="flex gap-4">
        <ClanLink href="/settings/characters#link-account" className="font-semibold text-gold hover:underline">
          Add your own character &rarr;
        </ClanLink>
        <ClanLink href={`/events/${eventId}/signup`} className="text-text-muted hover:text-gold">
          Open the sign-up page
        </ClanLink>
      </div>
    </div>
  );
}
