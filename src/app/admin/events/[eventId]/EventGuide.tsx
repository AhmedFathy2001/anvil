'use client';

import { usePathname, useRouter } from 'next/navigation';

import GuidedFlow from '@/components/GuidedFlow';
import type { FlowView } from '@/lib/guidedFlow';
import { useStartNow } from './EventNextStep';

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
  return (
    <GuidedFlow
      view={onTeams ? teamsView : view}
      onCustom={(id) => {
        if (id === 'start') void starter.start();
      }}
      customBusy={starter.starting}
      error={starter.error}
    />
  );
}
