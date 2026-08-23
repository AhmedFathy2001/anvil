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
import type { WeeklyCounts } from '@/lib/weeklyStage';

export function eventRailGroups(opts: {
  eventId: number;
  stage: EventStage;
  counts: StageCounts;
  /** Tile-authoring editors get the board and nothing else — the rest reject them anyway. */
  tilesOnly?: boolean;
  /** A board treasurer: the money tabs and nothing else. */
  moneyOnly?: boolean;
  /** What this board calls its entries, lower-case (lib/tileAuthoring). */
  taskNounPlural?: string;
}): SidebarGroup[] {
  const { eventId, stage, counts, tilesOnly, moneyOnly, taskNounPlural = 'tiles' } = opts;
  const base = `/admin/events/${eventId}`;

  const tiles = {
    href: `${base}/tiles`,
    label: `Board & ${taskNounPlural}`,
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

  // Someone granted this board's money runs two lists: who owes an entry fee, and who is owed a
  // prize. Everything else on the rail is a surface they can't act on anyway.
  if (moneyOnly) {
    return [{ label: 'This board', items: [signups, payouts] }, elsewhere];
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

/**
 * The same rail, for a weekly competition.
 *
 * A weekly's surfaces are narrower — there's nothing to author and nobody to draft — so it gets the
 * three that exist (the leaderboard, the roster, the baselines that decide whether a gain counts)
 * and the same way back out. The point is that walking into one feels like walking into an event.
 */
export function weeklyRailGroups(opts: {
  weeklyId: number;
  stage: EventStage;
  counts: WeeklyCounts;
}): SidebarGroup[] {
  const { weeklyId, stage, counts } = opts;
  const base = `/admin/events/weekly/${weeklyId}`;
  const missingBaselines = Math.max(0, counts.participants - counts.withBaseline);

  return [
    {
      label: stage === 'build' ? 'Getting ready' : stage === 'run' ? 'Live' : 'Wrapping up',
      items: [
        { href: base, label: stage === 'wrap' ? 'Results' : stage === 'run' ? 'Now' : 'Setup', icon: '◉' },
        {
          href: `${base}/participants`,
          label: 'Participants',
          icon: '👥',
          badge: counts.participants,
          matchPrefix: true,
        },
        {
          href: `${base}/baselines`,
          label: 'Baselines',
          icon: '◷',
          badge: counts.flagged > 0 ? `${counts.flagged} flagged` : missingBaselines > 0 ? `${missingBaselines} missing` : undefined,
          attn: counts.flagged > 0 || missingBaselines > 0,
          matchPrefix: true,
        },
      ],
    },
    {
      label: 'Elsewhere',
      items: [
        { href: '/admin/events', label: 'All events', icon: '↩' },
        { href: '/admin/weekly', label: 'New competition', icon: '＋' },
        { href: `/weekly/${weeklyId}`, label: 'Player view', icon: '↗' },
      ],
    },
  ];
}
