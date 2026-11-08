import ClanLink from '@/components/ClanLink';

import { MAX_LAB_FIELD } from '@/lib/labPlan';

import LabClient from './LabClient';

export const dynamic = 'force-dynamic';

/**
 * The tile lab: run any tile kind, on any event type, with any constraint, on your own account, without
 * a real event. Test players (lib/labField) fill big and many-team boards; missions drop on demand.
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
        Start a private board of any event type on one of your own characters, build the tiles you want to test, and
        play — or replay a scripted event from the dev client. Fill it with up to {MAX_LAB_FIELD.toLocaleString()} test players, solo or in teams,
        and simulate their progress to preview big boards, tile races and many-team standings. Missions can be added,
        dropped and expired on demand from the session page.
      </p>
      <p className="mb-6 text-sm text-text-muted">
        <ClanLink href="/staff/lab/scenarios" className="text-gold hover:underline">Replay scenarios</ClanLink>
        {' · '}
        <ClanLink href="/staff/chat-patterns" className="text-gold hover:underline">Chat patterns</ClanLink>
        {' · '}
        <ClanLink href="/staff/lab/supporter" className="text-gold hover:underline">Supporter lab</ClanLink>
        {' · '}
        <ClanLink href="/staff/lab/people" className="text-gold hover:underline">Test users &amp; roles</ClanLink>
      </p>
      <LabClient />
    </div>
  );
}
