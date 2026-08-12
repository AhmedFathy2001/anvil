'use client';

import { useState } from 'react';
import ClanPulse from './ClanPulse';
import ClanActivities from './ClanActivities';
import MembersDirectory from './MembersDirectory';
import type {
  ClanActivityAnalytics,
  ClanAnalytics,
  MemberListRow,
  RosterEvent,
} from '@/lib/memberProfile';

// The roster is what people come here for, so it stays the landing view and keeps the length it
// always had. The clue/minigame/collection-log analytics are a whole page of their own — parked on
// a second tab rather than stacked on top of the member list, which pushed the names off screen.
//
// Both tabs render from data the server already sent, so switching costs nothing.

type Tab = 'roster' | 'activities';

const TABS: { key: Tab; label: string }[] = [
  { key: 'roster', label: 'Roster' },
  { key: 'activities', label: 'Clues & minigames' },
];

export default function MembersTabs({
  members,
  analytics,
  rosterLog,
  activities,
}: {
  members: MemberListRow[];
  analytics: ClanAnalytics;
  rosterLog: RosterEvent[];
  activities: ClanActivityAnalytics;
}) {
  const [tab, setTab] = useState<Tab>('roster');

  return (
    <>
      <div className="flex flex-wrap gap-1 border-b border-card-border mb-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-gold text-gold font-medium'
                : 'border-transparent text-text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'roster' && (
        <>
          <ClanPulse analytics={analytics} rosterLog={rosterLog} />
          <MembersDirectory members={members} />
        </>
      )}

      {tab === 'activities' && <ClanActivities activities={activities} />}
    </>
  );
}
