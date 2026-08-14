// The event's own sidebar.
//
// Walking into an event used to leave you looking at a sidebar about the whole clan, with the
// event's seven surfaces squeezed into a tab strip that carried no counts — you opened Sign-ups to
// find out whether anyone had signed up. Inside an event the rail IS the event: every surface with
// its live number, grouped by whether it's part of the job you're doing right now.
//
// Ordering follows the stage (lib/eventStage). Nothing is ever hidden — a live board is still
// editable and a finished one is still readable — but what isn't the job goes quiet.

import type { SidebarGroup } from '@/app/admin/_components/AdminSidebar';
import type { EventStage, StageCounts } from '@/lib/eventStage';

export function eventRailGroups(opts: {
  eventId: number;
  stage: EventStage;
  counts: StageCounts;
  /** Tile-authoring editors get the board and nothing else — the rest reject them anyway. */
  tilesOnly?: boolean;
}): SidebarGroup[] {
  const { eventId, stage, counts, tilesOnly } = opts;
  const base = `/admin/events/${eventId}`;

  const tiles = {
    href: `${base}/tiles`,
    label: 'Board & tiles',
    icon: '▦',
    badge: counts.expectedTiles > 0 && counts.tileCount < counts.expectedTiles
      ? `${counts.tileCount}/${counts.expectedTiles}`
      : counts.tileCount,
    attn: counts.expectedTiles > 0 && counts.tileCount < counts.expectedTiles,
    matchPrefix: true,
  };
  const teams = {
    href: `${base}/teams`,
    label: stage === 'build' ? 'Teams & draft' : 'Rosters & subs',
    icon: '◈',
    badge: counts.teamCount === 0 ? 'none' : counts.teamCount,
    attn: counts.teamCount === 0,
    matchPrefix: true,
  };
  const signups = {
    href: `${base}/signups`,
    label: 'Sign-ups',
    icon: '✎',
    badge: counts.pendingSignups > 0 ? `${counts.pendingSignups} new` : counts.signupCount,
    attn: counts.pendingSignups > 0,
    matchPrefix: true,
  };
  const stats = { href: `${base}/stats`, label: 'Stats', icon: '▲', matchPrefix: true };
  const payouts = {
    href: `${base}/payouts`,
    label: 'Payouts',
    icon: '◍',
    badge: counts.unpaidPayouts > 0 ? `${counts.unpaidPayouts} unpaid` : counts.payoutCount || undefined,
    attn: counts.unpaidPayouts > 0,
    matchPrefix: true,
  };
  const survey = {
    href: `${base}/survey`,
    label: 'Survey',
    icon: '☰',
    badge: counts.surveyResponses > 0 ? counts.surveyResponses : counts.hasSurvey ? 'ready' : 'none',
    matchPrefix: true,
  };
  const settings = { href: `${base}/settings`, label: 'Rules & dates', icon: '⚙', matchPrefix: true };

  const elsewhere: SidebarGroup = {
    label: 'Elsewhere',
    items: [
      { href: '/admin/events', label: 'All events', icon: '↩' },
      { href: `/events/${eventId}`, label: 'Player view', icon: '↗' },
    ],
  };

  if (tilesOnly) {
    return [{ label: 'This board', items: [tiles] }, elsewhere];
  }

  if (stage === 'build') {
    return [
      {
        label: 'Getting ready',
        items: [
          { href: base, label: 'Setup', icon: '◉' },
          tiles,
          teams,
          signups,
          settings,
          survey,
        ],
      },
      { label: 'Once it starts', items: [{ ...stats, quiet: true }, { ...payouts, quiet: true }] },
      elsewhere,
    ];
  }

  if (stage === 'run') {
    return [
      {
        label: 'Live',
        items: [
          { href: base, label: 'Now', icon: '◉' },
          stats,
          teams,
          signups,
        ],
      },
      { label: 'Still editable', items: [{ ...tiles, quiet: true }, { ...settings, quiet: true }] },
      { label: 'After it ends', items: [{ ...payouts, quiet: true }, { ...survey, quiet: true }] },
      elsewhere,
    ];
  }

  return [
    {
      label: 'Wrapping up',
      items: [
        { href: base, label: 'Results', icon: '◉' },
        payouts,
        survey,
        stats,
      ],
    },
    {
      label: 'Finished — read-only',
      items: [
        { ...tiles, badge: counts.tileCount, attn: false, quiet: true },
        { ...teams, badge: counts.teamCount, attn: false, quiet: true },
        { ...settings, quiet: true },
      ],
    },
    elsewhere,
  ];
}
