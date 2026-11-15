// The settings map: every setting of an event with what it is set to now, grouped by the tab it sits
// on, each row a link to the setting. Shown on the settings landing so a host sees the whole
// configuration at a glance. Pure: the facts come in, rows come out (tests/event-settings-map).
//
// It only READS: no setting moves, and every link is the same anchor the search box opens.

import { SETTINGS_INDEX, tabHref, tabsFor, type SettingsKind, type SettingsTab } from './eventSettingsTabs.ts';

export interface MapFacts {
  name: string;
  /** "Classic bingo", "Tile race"... (lib/eventModes eventModeLabel). */
  formatLabel: string;
  boardSize: number;
  startDate: string | null;
  endDate: string | null;
  tilesRevealed: boolean;
  tilesRevealAt: string | null;
  /** lib/eventRules revealPolicy. */
  revealPolicy: string;
  /** lib/eventRules standings.visibility. */
  standings: 'live' | 'at-end' | 'at-date';
  worldModeCount: number;
  /** events.visibility. */
  visibility: string;
  signupsEnabled: boolean;
  signupFee: number | null;
  teamPlacement: string;
  teamCount: number | null;
  /** Formats a date for the viewer (their own time zone, in the browser). */
  fmtDate: (iso: string) => string;
}

export interface MapRow {
  id: string;
  label: string;
  /** What it is set to; null when there is nothing short to say (the link still works). */
  value: string | null;
  href: string;
  /** The row lives outside Settings (a sibling page of the event). */
  elsewhere: boolean;
}

export interface MapGroup {
  key: string;
  label: string;
  blurb: string;
  href: string;
  rows: MapRow[];
}

const PLACEMENT_WORDS: Record<string, string> = {
  auto: 'Auto-balance',
  pick: 'Players pick a team',
  draft: 'Host drafts',
  solo: 'Everyone solo',
};

const REVEAL_WORDS: Record<string, string> = {
  all: 'All at once',
  scheduled: 'On a schedule per tile',
  interval: 'A few tiles every so often',
  bounty: 'One at a time, first to finish',
  rotating: 'A rolling window of tiles',
};

function valueFor(id: string, f: MapFacts): string | null {
  switch (id) {
    case 'look':
      return f.name;
    case 'format':
      return `${f.formatLabel}${f.boardSize ? `, ${f.boardSize}${f.boardSize <= 12 ? `x${f.boardSize}` : ' tiles'}` : ''}`;
    case 'schedule':
      if (!f.startDate) return 'No dates set';
      return `${f.fmtDate(f.startDate)} to ${f.endDate ? f.fmtDate(f.endDate) : 'no end date'}`;
    case 'reveal':
      if (f.tilesRevealed) return 'Tiles are visible';
      return f.tilesRevealAt ? `Hidden until ${f.fmtDate(f.tilesRevealAt)}` : 'Hidden until the start';
    case 'opening':
      return REVEAL_WORDS[f.revealPolicy] ?? null;
    case 'standings':
      return f.standings === 'live' ? 'Shown live' : f.standings === 'at-end' ? 'Hidden until the end' : 'Hidden until a date';
    case 'worlds':
      return f.worldModeCount > 0 ? `${f.worldModeCount} game ${f.worldModeCount === 1 ? 'mode' : 'modes'} count` : 'Main game only';
    case 'access':
      return f.visibility === 'public' ? 'Public' : f.visibility === 'invited' ? 'Invited only' : 'Your clan';
    case 'signups':
      return `${f.signupsEnabled ? 'Sign-up form on' : 'No sign-up form'}, ${f.signupFee ? `${f.signupFee.toLocaleString('en-US')} gp fee` : 'no fee'}`;
    case 'teams':
      return `${PLACEMENT_WORDS[f.teamPlacement] ?? 'Host drafts'}${f.teamPlacement === 'auto' ? `, ${f.teamCount ?? 4} teams` : ''}`;
    default:
      return null;
  }
}

/** Settings entries a host expects to see on the map (the rest are searchable, but add only noise). */
const ELSEWHERE_ON_MAP = ['signups', 'teams', 'discord', 'payouts', 'prizes', 'survey'];

export function settingsMap(eventId: number, kind: SettingsKind, facts: MapFacts): MapGroup[] {
  const tabs = tabsFor(kind);
  const groups: MapGroup[] = [];
  for (const tab of tabs) {
    const rows: MapRow[] = [];
    for (const e of SETTINGS_INDEX) {
      if (e.elsewhere || e.clanPath) continue;
      if (e.only && !e.only(kind)) continue;
      const t: SettingsTab = typeof e.tab === 'function' ? e.tab(kind) : e.tab;
      if (t !== tab.key) continue;
      rows.push({ id: e.id, label: e.label, value: valueFor(e.id, facts), href: `${tabHref(eventId, tab.key)}#${e.id}`, elsewhere: false });
    }
    if (rows.length > 0) groups.push({ key: tab.key, label: tab.label, blurb: tab.blurb, href: tabHref(eventId, tab.key), rows });
  }
  const elsewhere: MapRow[] = [];
  for (const e of SETTINGS_INDEX) {
    if (!e.elsewhere || !ELSEWHERE_ON_MAP.includes(e.id)) continue;
    if (e.only && !e.only(kind)) continue;
    elsewhere.push({ id: e.id, label: e.label, value: valueFor(e.id, facts), href: `/admin/events/${eventId}/${e.elsewhere}`, elsewhere: true });
  }
  if (elsewhere.length > 0) {
    groups.push({
      key: 'elsewhere',
      label: 'Also for this event',
      blurb: 'These live on their own pages, not in Settings.',
      href: `/admin/events/${eventId}`,
      rows: elsewhere,
    });
  }
  return groups;
}
