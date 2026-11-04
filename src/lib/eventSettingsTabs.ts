// An event's Settings, split into tabs (app/admin/events/[eventId]/settings/*), and the index its
// search box reads. Pure: no database, so the tab sets and the matching are unit-tested
// (tests/event-settings-tabs).
//
// A creator space and a clan are DIFFERENT shapes, not one page with parts hidden:
//
//   space   Event · Viewers · Stream · Board & play · More
//   clan    Event · Board & play · Entry & co-hosts · Staff · More      (+ Stream when it streams)
//
// The same panels back both where they mean the same thing; the words are the host's.

export type SettingsTab = 'event' | 'board' | 'access' | 'staff' | 'stream' | 'more';

export interface SettingsKind {
  /** A creator space (lib/creatorSpaces isCreatorSpace). */
  creator: boolean;
  /** It streams its events: a creator space always, a clan with Streaming on (streamsEvents). */
  streams: boolean;
}

export interface TabInfo {
  key: SettingsTab;
  /** Path under /settings ('' for the first tab). */
  slug: string;
  label: string;
}

const SLUG: Record<SettingsTab, string> = { event: '', board: 'board', access: 'access', staff: 'staff', stream: 'stream', more: 'more' };

export function tabsFor(kind: SettingsKind): TabInfo[] {
  const t = (key: SettingsTab, label: string): TabInfo => ({ key, slug: SLUG[key], label });
  if (kind.creator) {
    return [t('event', 'Event'), t('access', 'Viewers'), t('stream', 'Stream'), t('board', 'Board & play'), t('more', 'More')];
  }
  return [
    t('event', 'Event'),
    t('board', 'Board & play'),
    t('access', 'Entry & co-hosts'),
    t('staff', 'Staff'),
    ...(kind.streams ? [t('stream', 'Stream')] : []),
    t('more', 'More'),
  ];
}

/** Where a tab lives, for an event: `/admin/events/7/settings/board`. */
export function tabHref(eventId: number, tab: SettingsTab): string {
  const slug = SLUG[tab];
  return `/admin/events/${eventId}/settings${slug ? `/${slug}` : ''}`;
}

/** A space keeps its board staff on Stream (they are the stream's mods); a clan on Staff. */
export function staffTab(kind: SettingsKind): SettingsTab {
  return kind.creator ? 'stream' : 'staff';
}

// ── Search ───────────────────────────────────────────────────────────────────────────────────────

export interface SettingsEntry {
  /** The anchor on its tab (an element id), or the page for an entry elsewhere. */
  id: string;
  label: string;
  /** Other words people type for it. */
  keywords: string[];
  /** The settings tab it sits on, or a sibling page of the event (`elsewhere`). */
  tab: SettingsTab | ((kind: SettingsKind) => SettingsTab);
  /** For entries outside Settings: the event page path after /admin/events/<id>/. */
  elsewhere?: string;
  /** Only for this kind of host. */
  only?: (kind: SettingsKind) => boolean;
}

export const SETTINGS_INDEX: SettingsEntry[] = [
  { id: 'look', label: 'Name, icon and banner', keywords: ['name', 'rename', 'icon', 'banner', 'image', 'logo', 'picture', 'look'], tab: 'event' },
  { id: 'format', label: 'Format', keywords: ['type', 'shape', 'board size', 'mode', 'bingo', 'race', 'ladder', 'points', 'grid'], tab: 'event' },
  { id: 'schedule', label: 'Dates and schedule', keywords: ['dates', 'start', 'end', 'time', 'timezone', 'open-ended', 'when'], tab: 'event' },
  { id: 'reveal', label: 'Reveal tiles', keywords: ['hide tiles', 'reveal', 'visible', 'early', 'hidden board', 'show board'], tab: 'board' },
  { id: 'opening', label: 'How tiles open', keywords: ['progressive', 'rotating', 'draw', 'staggered', 'one at a time', 'reveal rules', 'timer'], tab: 'board' },
  { id: 'standings', label: 'Hide standings', keywords: ['leaderboard', 'scores', 'hidden standings', 'curtain', 'ranking'], tab: 'board' },
  { id: 'worlds', label: 'Game-mode worlds', keywords: ['leagues', 'deadman', 'game mode', 'hardcore', 'fresh start', 'worlds'], tab: 'board' },
  { id: 'rulebook', label: 'Rulebook', keywords: ['rules', 'shared accounts', 'post rules', 'discord rules', 'cheating'], tab: 'board' },
  { id: 'access', label: 'Who can see and enter', keywords: ['visibility', 'who can see', 'invite', 'invited', 'advertise', 'public', 'private', 'entry', 'listed'], tab: 'access' },
  {
    id: 'gate',
    label: 'Who can join (viewers)',
    keywords: ['twitch', 'kick', 'youtube', 'followers', 'subscribers', 'subs', 'members', 'viewers', 'gate', 'discord role', 'boosters'],
    tab: 'access',
    only: (k) => k.streams,
  },
  {
    id: 'cohosts',
    label: 'Co-hosts and the pot',
    keywords: ['co-host', 'cohost', 'clans', 'invite clan', 'cash', 'pot', 'settlement', 'clan vs clan'],
    tab: 'access',
    only: (k) => !k.creator,
  },
  { id: 'staff', label: 'Board staff', keywords: ['board editor', 'treasurer', 'helpers', 'mods', 'moderators', 'staff', 'editor'], tab: staffTab },
  {
    id: 'overlay',
    label: 'Stream overlay and channel panels',
    keywords: ['obs', 'overlay', 'stream', 'panels', 'celebrate', 'theme', 'browser source', 'kick panels', 'twitch panels'],
    tab: 'stream',
    only: (k) => k.streams,
  },
  { id: 'clone', label: 'Clone event', keywords: ['copy', 'run again', 'duplicate', 'clone'], tab: 'more' },
  { id: 'template', label: 'Save as a template', keywords: ['preset', 'template', 'reuse'], tab: 'more' },
  { id: 'library', label: 'Board library', keywords: ['share', 'library', 'suggest', 'starter board', 'publish'], tab: 'more' },
  { id: 'recompute', label: 'Recompute completions', keywords: ['repair', 'heal', 'completions', 'fix', 'recount'], tab: 'more' },
  { id: 'delete', label: 'Delete event', keywords: ['remove', 'danger', 'delete', 'erase'], tab: 'more' },
  // Elsewhere in the event: what people look for in Settings but lives on its own tab.
  { id: 'discord', label: 'Discord channels and pings', keywords: ['discord', 'channels', 'webhook', 'pings', 'roles', 'announcements', 'posts'], tab: 'event', elsewhere: 'discord' },
  { id: 'signups', label: 'Sign-up questions and fees', keywords: ['sign-up', 'signup', 'questions', 'fee', 'entry fee', 'form', 'applications'], tab: 'event', elsewhere: 'signups' },
  { id: 'teams', label: 'Teams and placement', keywords: ['teams', 'draft', 'captains', 'auto-balance', 'placement', 'solo', 'pick team'], tab: 'event', elsewhere: 'teams' },
  { id: 'prizes', label: 'Prizes and payouts', keywords: ['prizes', 'payouts', 'coffer', 'gp', 'winnings', 'pool'], tab: 'event', elsewhere: 'payouts' },
  { id: 'tiles', label: 'Tiles and points', keywords: ['tiles', 'tasks', 'points', 'board', 'goals', 'tile kinds'], tab: 'event', elsewhere: 'tiles' },
];

export interface SearchHit {
  id: string;
  label: string;
  /** Where it opens: a settings tab with #id, or the sibling page. */
  href: string;
  /** "Board & play", or "Discord tab" for an entry elsewhere. */
  where: string;
  elsewhere: boolean;
}

const ELSEWHERE_LABEL: Record<string, string> = { discord: 'Discord tab', signups: 'Sign-ups', teams: 'Teams', payouts: 'Prizes', tiles: 'Tiles' };

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Entries matching what was typed, best first: a label that starts with it, then one containing it,
 * then a keyword. Every word typed must appear somewhere in the entry. Settings before elsewhere.
 */
export function searchSettings(query: string, eventId: number, kind: SettingsKind, limit = 8): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(' ');
  const tabs = tabsFor(kind);
  const scored: { hit: SearchHit; score: number }[] = [];
  for (const e of SETTINGS_INDEX) {
    if (e.only && !e.only(kind)) continue;
    const label = norm(e.label);
    const keys = e.keywords.map(norm);
    const hay = `${label} ${keys.join(' ')}`;
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 0;
    if (label.startsWith(q)) score = 300;
    else if (label.includes(q)) score = 200;
    else if (keys.some((k) => k.startsWith(q))) score = 150;
    else score = 100;
    const tab = typeof e.tab === 'function' ? e.tab(kind) : e.tab;
    // A tab this host does not have (a clan without Streaming and the overlay) is not a result.
    if (!e.elsewhere && !tabs.some((t) => t.key === tab)) continue;
    const href = e.elsewhere ? `/admin/events/${eventId}/${e.elsewhere}` : `${tabHref(eventId, tab)}#${e.id}`;
    const where = e.elsewhere ? (ELSEWHERE_LABEL[e.elsewhere] ?? e.elsewhere) : (tabs.find((t) => t.key === tab)?.label ?? '');
    scored.push({ hit: { id: e.id, label: e.label, href, where, elsewhere: !!e.elsewhere }, score: score - (e.elsewhere ? 50 : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.hit);
}
