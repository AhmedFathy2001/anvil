'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { clanFetch } from '@/lib/clanFetch';

import GuidedFlow from '@/components/GuidedFlow';
import type { FlowView } from '@/lib/guidedFlow';
import { useStartNow } from './EventNextStep';

/** Fired on `window` when the strip changed who is on which team, so the Teams page reloads its rosters. */
export const TEAMS_CHANGED = 'anvil:teams-changed';

/**
 * The "Run an event" guide strip, on every page of an event's admin (lib/guidedFlows/runEvent).
 *
 * It replaced the Next step panel and the lifecycle bar that only the event home had, so an admin on
 * the Tiles or Teams tab sees the same next step as on the home page. Starting goes through the same
 * readiness gate and confirm the Teams page uses (useStartNow).
 *
 * No storage scope: dismissing it on one event dismisses it on all of them, so an admin who knows the
 * job is asked once, not once per event. "Show guide" brings it back.
 */
export default function EventGuide({ view, teamsView, eventId }: { view: FlowView; teamsView: FlowView; eventId: number }) {
  const router = useRouter();
  // On the Teams tab the strip opens the Teams step while teams are not done (runEventFlow `page`).
  const onTeams = /\/admin\/events\/\d+\/teams\/?$/.test(usePathname() ?? '');
  const starter = useStartNow(eventId, () => router.refresh());
  // "Team everyone up": seat the pool the way the board's Team placement seats a sign-up. The same
  // request the Teams page's own button sends; that page reloads its rosters on TEAMS_CHANGED.
  const [teaming, setTeaming] = useState(false);
  const [teamError, setTeamError] = useState('');
  async function teamUp() {
    setTeaming(true);
    setTeamError('');
    try {
      const res = await clanFetch(`/api/admin/events/${eventId}/place-pool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placement: 'as-set' }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setTeamError(d.error || 'Could not team everyone up.');
      else if (!d.placed) setTeamError('Nobody is waiting for a team. People who signed up are added once their sign-up is approved.');
      else {
        window.dispatchEvent(new Event(TEAMS_CHANGED));
        router.refresh();
      }
    } catch {
      setTeamError('Could not reach Anvil. Check your connection and try again.');
    } finally {
      setTeaming(false);
    }
  }
  return (
    <GuidedFlow
      view={onTeams ? teamsView : view}
      onCustom={(id) => {
        if (id === 'start') void starter.start();
        if (id === 'team-up') void teamUp();
      }}
      customBusy={starter.starting || teaming}
      error={starter.error || teamError}
    />
  );
}
