import ClanLink from '@/components/ClanLink';

import LabClient from './LabClient';

export const dynamic = 'force-dynamic';

/**
 * The tile lab: run any tile kind, with any constraint, on your own account, without a real bingo.
 *
 * A session is an ordinary board in a hidden clan (lib/lab), so the tile editor, the plugin, and the
 * whole scoring engine are the real ones. What changes is everything that would reach the outside:
 * while a session runs, your character's posts, moments and profile writes land in the session's log
 * instead of your clan's Discord or your real collection log.
 */
export default function StaffLabPage() {
  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Tile lab
      </h1>
      <p className="mb-2 text-sm text-text-muted">
        Start a private board on one of your own characters, build the tiles you want to test, and play — or replay a
        scripted event from the dev client.
      </p>
      <p className="mb-6 text-sm text-text-muted">
        <ClanLink href="/staff/lab/scenarios" className="text-gold hover:underline">Replay scenarios</ClanLink>
        {' · '}
        <ClanLink href="/staff/chat-patterns" className="text-gold hover:underline">Chat patterns</ClanLink>
      </p>
      <LabClient />
    </div>
  );
}
