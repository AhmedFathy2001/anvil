// "What's new", in players' words: a short, hand-written list for /whats-new.
//
// NOT the release notes. Those (releases/*.md, /changelog) list every fix for every release; this is
// the handful of things a player or a clan's staff would actually notice, grouped, with links to
// where they can try them. Each entry says who it is for, so the page can put the ones that matter to
// the viewer first and fill the links with THEIR clan ("Set The AFK Spot's name colour").
//
// Pure: no database. The page resolves the viewer (app/whats-new/page.tsx) and hands a `Viewer` to
// the functions below, which is what tests/whats-new.test.ts exercises.
//
// WRITING ONE: newest first. A title of a few words, one or two plain sentences, no version numbers,
// no internal names. Links go to real pages only. A link that needs one of the viewer's clans puts
// `{clan}` in its href (the clan's slug) and may put `{clanName}` in its label; it is shown once per
// matching clan, and dropped for a viewer with none. A plugin change that is not in the RuneLite hub
// build yet gets `pluginUpdate: 'next'`, which the page shows as "Coming in the next plugin update".

import type { SupporterTierId } from './supporterTiers.ts';

/** A condition on one of the viewer's clans. Every field given must hold for the same clan. */
export interface ClanReq {
  /** 'staff' = moderator or above (owner, admin, treasurer, moderator); 'admin' = owner or admin; 'owner'. */
  role?: 'staff' | 'admin' | 'owner';
  /** Minimum boost level. */
  boost?: 1 | 2 | 3;
  /** An in-game clan, or a creator space. Either, when left out. */
  kind?: 'clan' | 'creator';
}

/**
 * Who an entry is for. An entry with several audiences is for anyone matching ANY of them; a clan
 * condition (`{ clan: … }`) combines its fields for one clan, e.g. "an admin of a boosted clan".
 */
export type Audience =
  | 'everyone'
  /** Any Supporter tier. */
  | 'supporter'
  /** Champion or Patron. */
  | 'champion+'
  | 'patron'
  /** Moderator or above in any clan. */
  | 'clanStaff'
  /** Owner or admin of any clan. */
  | 'clanAdmin'
  /** A member or staff of a clan at boost level 1 or more. */
  | 'boostedClan'
  /** The same, level 2 or more. */
  | 'boostedClan2'
  /** Owns a creator space. */
  | 'creatorOwner'
  /** Has played with the Anvil plugin. */
  | 'pluginUser'
  | { clan: ClanReq };

export interface WhatsNewLink {
  label: string;
  /** A site path. `{clan}` is replaced by the slug of each matching clan (see `clan`). */
  href: string;
  /** Which of the viewer's clans fill `{clan}`. Any clan of theirs when left out. */
  clan?: ClanReq;
  /** The page needs a signed-in account: a signed-out viewer is sent through sign-in. */
  account?: boolean;
  /** The page only exists on the main Anvil site, not on a self-hosted or custom-domain instance. */
  apexOnly?: boolean;
}

export interface WhatsNewEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  /** One or two plain sentences. */
  body: string;
  /** Everyone, when left out. */
  audience?: Audience[];
  links?: WhatsNewLink[];
  /** Set while a plugin change waits for the RuneLite hub. */
  pluginUpdate?: 'next';
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026-11-09-side-panel',
    date: '2026-11-09',
    title: 'A new side panel',
    body: 'Every tab in the RuneLite side panel has been rebuilt: where you stand at a glance, what to do next, your profile with a banner and display case, a searchable collection log, and every live board you’re on tracked at once.',
    audience: ['pluginUser'],
    links: [{ label: 'The side panel, tab by tab', href: '/guide/side-panel' }],
    pluginUpdate: 'next',
  },
  {
    id: '2026-11-09-team-competitions',
    date: '2026-11-09',
    title: 'Team and clan vs clan competitions',
    body: 'Run a competition as balanced teams, or race any number of other clans. Each clan accepts the invite, picks all or selected members, and players can opt out.',
    audience: ['clanStaff'],
    links: [{ label: 'How team competitions work', href: '/guide/team-competitions' }],
  },
  {
    id: '2026-11-09-announcements',
    date: '2026-11-09',
    title: 'Announcements your clan sets for everyone',
    body: 'Slayer, clues, speedruns, kill count milestones, BA gambles and your own custom messages can now post too, each with its own wording and screenshot switch. Members follow the clan’s defaults unless they pick their own.',
    audience: ['clanAdmin'],
    links: [{ label: 'Clan Discord settings', href: '/c/{clan}/admin/integrations', clan: { role: 'admin' } }],
  },
  {
    id: '2026-11-09-my-announcements',
    date: '2026-11-09',
    title: 'Choose what you announce',
    body: 'Drops now post from 1m or 1 in 1,000 by default, following your clan. Turn on new kinds like slayer or kill count milestones, change the wording, and give each of your own webhooks its own filters.',
    audience: ['pluginUser'],
    links: [{ label: 'Your announcement settings', href: '/settings/announcements', account: true }],
  },
  {
    id: '2026-11-09-chat-channels',
    date: '2026-11-09',
    title: 'Event chat channels',
    body: 'Event chat now has My team, All teams and Announcements, with unread counts. Only the host and mods post announcements.',
    audience: ['pluginUser', 'clanStaff'],
  },
  {
    id: '2026-11-09-races',
    date: '2026-11-09',
    title: 'Branching tile races',
    body: 'Tile races can split into several roads and meet again, with one start and one finish. The race track shows each road and where you are.',
    audience: ['clanStaff'],
    links: [{ label: 'Event formats', href: '/guide/formats' }],
  },
  {
    id: '2026-11-09-records',
    date: '2026-11-09',
    title: 'Records, efficient hours and drop luck',
    body: 'See your best day, week, month and year for every skill and boss, your efficient hours, and whether you went dry or got spooned on a drop.',
    links: [{ label: 'Odds, luck and records', href: '/guide/luck-and-records' }],
  },
  {
    id: '2026-11-07-name-looks',
    date: '2026-11-07',
    title: 'Name colours for dark and light pages',
    body: 'Supporters can pick one name look for dark backgrounds and another for light ones. Leave it alone and Anvil adjusts your colours so your name stays readable everywhere.',
    audience: ['supporter'],
    links: [
      { label: 'Set your name look', href: '/settings/supporter', account: true },
      { label: 'About Supporter', href: '/supporter', apexOnly: true },
    ],
  },
  {
    id: '2026-11-07-clan-name-colour',
    date: '2026-11-07',
    title: 'Your clan’s own name colour',
    body: 'Boosted clans can choose their own clan-name colour or gradient, with separate looks for dark and light backgrounds. Owners and admins set it on the clan’s Boosts page.',
    audience: [{ clan: { role: 'admin', boost: 1, kind: 'clan' } }, 'boostedClan'],
    links: [
      { label: 'Set {clanName}’s name colour', href: '/c/{clan}/admin/clan/boosts', clan: { role: 'admin', boost: 1, kind: 'clan' } },
      { label: 'How clan boosts work', href: '/settings/boosts', account: true },
    ],
  },
  {
    id: '2026-11-07-character-banners',
    date: '2026-11-07',
    title: 'A banner for each character',
    body: 'Your banner and avatar now show on every character you play, on the site and in the plugin. You can also give each character its own, or keep your default.',
    audience: ['champion+'],
    links: [{ label: 'Profile look', href: '/settings/look', account: true }],
  },
  {
    id: '2026-11-07-animated-banners',
    date: '2026-11-07',
    title: 'Animated banners play in the plugin',
    body: 'Animated clan and profile banners now play in the plugin’s side panel, cropped at the spot you picked on the site.',
    audience: ['champion+', 'boostedClan2'],
    links: [{ label: 'Profile look', href: '/settings/look', account: true }],
  },
  {
    id: '2026-11-07-live-reactions',
    date: '2026-11-07',
    title: 'Live reactions on the Feed',
    body: 'GZ, Sad and Sit reactions on the plugin’s Feed tab update live for everyone watching, including your other open clients.',
    audience: ['pluginUser'],
    links: [{ label: 'Plugin guide', href: '/guide/plugin' }],
  },
  {
    id: '2026-11-07-plugin-panel-fixes',
    date: '2026-11-07',
    title: 'A tidier plugin side panel',
    body: 'Clan icons and player details are no longer cut off, and Supporter names show their full colours. Buttons you can’t use right now look greyed out.',
    audience: ['pluginUser'],
  },
  {
    id: '2026-11-07-boosts-per-clan',
    date: '2026-11-07',
    title: 'One boost per clan',
    body: 'Your boosts are listed once per clan, and Anvil picks which of your characters each one rides on. Your profile shows them the same way.',
    audience: ['champion+'],
    links: [{ label: 'Your boosts', href: '/settings/boosts', account: true }],
  },
  {
    id: '2026-11-07-display-case-dates',
    date: '2026-11-07',
    title: 'Drop dates in your display case',
    body: 'A display-case item you got before Anvil was tracking now shows the date and kill count of its first recorded drop, when Anvil has one.',
    audience: ['supporter'],
    links: [{ label: 'Your display case', href: '/settings/look', account: true }],
  },
  {
    id: '2026-11-07-creator-plans',
    date: '2026-11-07',
    title: 'Plans: monthly or yearly',
    body: 'Creators can start or upgrade a plan straight from the pricing page. A Monthly / Yearly switch shows yearly prices, two months free, as they become available.',
    audience: ['creatorOwner', 'clanAdmin'],
    links: [
      { label: 'Pricing', href: '/pricing', apexOnly: true },
      { label: 'Yearly prices', href: '/pricing?billing=yearly', apexOnly: true },
    ],
  },
  {
    id: '2026-11-07-coffer',
    date: '2026-11-07',
    title: 'Coffer: donors credited, no double entries',
    body: 'Staff can name who gave the gp when adding to the coffer with /coffer add in Discord. A deposit or withdrawal seen in clan chat is confirmed by the next member to open the coffer, instead of showing twice.',
    audience: [{ clan: { role: 'staff', kind: 'clan' } }],
    links: [{ label: 'Coffer guide', href: '/guide/coffer' }],
  },
  {
    id: '2026-11-07-event-posts',
    date: '2026-11-07',
    title: 'Clan event posts stay single',
    body: 'Changing where a clan event is posted now moves its announcement instead of leaving a second copy behind.',
    audience: [{ clan: { role: 'staff', kind: 'clan' } }],
    links: [{ label: '{clanName} clan events', href: '/c/{clan}/admin/clan-events', clan: { role: 'staff', kind: 'clan' } }],
  },
  {
    id: '2026-11-07-people-guides',
    date: '2026-11-07',
    title: 'Guides for your roster and staff roles',
    body: 'Two new guides cover who can join your clan, how guests work, and what each staff role can and can’t do.',
    audience: ['clanStaff'],
    links: [
      { label: 'Your people', href: '/guide/people' },
      { label: 'Staff roles', href: '/guide/staff-roles' },
      { label: '{clanName} people', href: '/c/{clan}/admin/people', clan: { role: 'staff' } },
    ],
  },
  {
    id: '2026-11-07-guides-tabs',
    date: '2026-11-07',
    title: 'Guides in two tabs',
    body: 'The guides page is split into Using Anvil, for the site and plugin, and In-game guides, for playing the game itself.',
    links: [
      { label: 'Using Anvil', href: '/guide' },
      { label: 'In-game guides', href: '/guide?tab=ingame' },
    ],
  },
  {
    id: '2026-11-07-footer',
    date: '2026-11-07',
    title: 'A cleaner footer',
    body: 'The links at the bottom of each page are grouped into Product, Support and Legal, and this page is one of them.',
  },
];

// =============================================================================
// The viewer, and matching
// =============================================================================

export interface ViewerClan {
  slug: string;
  name: string;
  /** 'clan' | 'creator' (lib/creatorSpaces). */
  kind: string;
  /** Their staff role here ('owner', 'admin', 'treasurer', 'moderator', 'editor'), or null. */
  role: string | null;
  boostLevel: number;
}

export interface Viewer {
  signedIn: boolean;
  tier: SupporterTierId | null;
  clans: ViewerClan[];
  pluginUser: boolean;
  /** On the main Anvil site (apex), where the marketing pages exist. */
  onApex: boolean;
}

export const SIGNED_OUT: Viewer = { signedIn: false, tier: null, clans: [], pluginUser: false, onApex: true };

const STAFF_ROLES = new Set(['owner', 'admin', 'treasurer', 'moderator']);
const ADMIN_ROLES = new Set(['owner', 'admin']);
const TIER_RANK: Record<SupporterTierId, number> = { supporter: 1, champion: 2, patron: 3 };

export function clanMeets(clan: ViewerClan, req: ClanReq | undefined): boolean {
  if (!req) return true;
  if (req.kind && (clan.kind === 'creator' ? 'creator' : 'clan') !== req.kind) return false;
  if (req.boost && clan.boostLevel < req.boost) return false;
  const role = clan.role ?? '';
  if (req.role === 'owner' && role !== 'owner') return false;
  if (req.role === 'admin' && !ADMIN_ROLES.has(role)) return false;
  if (req.role === 'staff' && !STAFF_ROLES.has(role)) return false;
  return true;
}

/** Does this one audience describe the viewer? 'everyone' is true for all, signed in or not. */
export function audienceMatches(a: Audience, v: Viewer): boolean {
  const rank = v.tier ? TIER_RANK[v.tier] : 0;
  const anyClan = (req: ClanReq) => v.clans.some((c) => clanMeets(c, req));
  if (typeof a === 'object') return anyClan(a.clan);
  switch (a) {
    case 'everyone':
      return true;
    case 'supporter':
      return rank >= 1;
    case 'champion+':
      return rank >= 2;
    case 'patron':
      return rank >= 3;
    case 'clanStaff':
      return anyClan({ role: 'staff' });
    case 'clanAdmin':
      return anyClan({ role: 'admin' });
    case 'boostedClan':
      return anyClan({ boost: 1 });
    case 'boostedClan2':
      return anyClan({ boost: 2 });
    case 'creatorOwner':
      return anyClan({ role: 'owner', kind: 'creator' });
    case 'pluginUser':
      return v.pluginUser;
  }
}

/**
 * Is this entry FOR this viewer in particular — a targeted audience that matches? Entries for
 * everyone are not personal, so they never land in "For you"; they are in "Everything new".
 */
export function isForViewer(entry: WhatsNewEntry, v: Viewer): boolean {
  if (!v.signedIn) return false;
  return (entry.audience ?? []).some((a) => a !== 'everyone' && audienceMatches(a, v));
}

// =============================================================================
// Links
// =============================================================================

export interface ResolvedLink {
  label: string;
  href: string;
  /** Signed-out viewer, account page: `href` already goes through sign-in. */
  signIn: boolean;
}

/** How many of a person's clans one clan link may expand into, so a card never becomes a list. */
export const MAX_CLAN_LINKS = 3;

/**
 * An entry's links for this viewer. A `{clan}` link becomes one link per matching clan (up to
 * MAX_CLAN_LINKS) and disappears when none match; an apex-only page disappears off the apex; an
 * account page goes through sign-in for a signed-out viewer. The entry itself is never dropped.
 */
export function resolveLinks(entry: WhatsNewEntry, v: Viewer): ResolvedLink[] {
  const out: ResolvedLink[] = [];
  for (const link of entry.links ?? []) {
    if (link.apexOnly && !v.onApex) continue;
    if (needsClan(link)) {
      for (const c of v.clans.filter((c) => clanMeets(c, link.clan)).slice(0, MAX_CLAN_LINKS)) {
        out.push({ label: fill(link.label, c), href: fill(link.href, c), signIn: false });
      }
      continue;
    }
    // A label naming a clan without a clan to name is left out rather than shown with a hole in it.
    if (link.label.includes('{')) continue;
    const signIn = !!link.account && !v.signedIn;
    out.push({ label: link.label, href: signIn ? signInHref(link.href) : link.href, signIn });
  }
  return out;
}

/** Does the entry have a link this viewer could get by signing in, i.e. one naming a clan? */
export function hasClanLinks(entry: WhatsNewEntry): boolean {
  return (entry.links ?? []).some(needsClan);
}

export function signInHref(href: string): string {
  return `/login?return=${encodeURIComponent(href)}`;
}

function needsClan(link: WhatsNewLink): boolean {
  return link.href.includes('{clan}') || link.label.includes('{clanName}');
}

function fill(s: string, c: ViewerClan): string {
  // {clanName} first: replacing {clan} first would eat the start of it.
  return s.replaceAll('{clanName}', c.name).replaceAll('{clan}', encodeURIComponent(c.slug));
}

/** "7 Nov 2026" */
export function entryDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// =============================================================================
// Tabs: one per scope, an entry may sit in several
// =============================================================================

export type WhatsNewTab = 'you' | 'everyone' | 'players' | 'staff' | 'supporters' | 'creators';

/** Query parameter that carries the tab (`/whats-new?tab=staff`). */
export const WHATS_NEW_TAB_PARAM = 'tab';

/** Left to right. 'you' is only offered to a signed-in viewer with entries aimed at them. */
export const WHATS_NEW_TABS: { id: WhatsNewTab; label: string }[] = [
  { id: 'you', label: 'For you' },
  { id: 'everyone', label: 'Everyone' },
  { id: 'players', label: 'Players' },
  { id: 'staff', label: 'Clan staff' },
  { id: 'supporters', label: 'Supporters' },
  { id: 'creators', label: 'Creators' },
];

/** The scope tabs (not 'you') an audience puts an entry in. */
function audienceTabs(a: Audience): WhatsNewTab[] {
  if (typeof a === 'object') return a.clan.kind === 'creator' ? ['creators', 'staff'] : ['staff'];
  switch (a) {
    case 'everyone':
      return ['everyone'];
    case 'pluginUser':
      return ['players'];
    case 'clanStaff':
    case 'clanAdmin':
      return ['staff'];
    case 'supporter':
    case 'champion+':
    case 'patron':
    case 'boostedClan':
    case 'boostedClan2':
      return ['supporters'];
    case 'creatorOwner':
      return ['creators'];
  }
}

/** Scope tabs for one entry, in tab order. No audience means everyone. */
export function entryTabs(entry: WhatsNewEntry): WhatsNewTab[] {
  const aud = entry.audience?.length ? entry.audience : (['everyone'] as Audience[]);
  const set = new Set(aud.flatMap(audienceTabs));
  return WHATS_NEW_TABS.map((t) => t.id).filter((id) => set.has(id));
}

export interface TabBucket {
  id: WhatsNewTab;
  label: string;
  entries: WhatsNewEntry[];
}

/** Non-empty tabs for this viewer, with their entries (input order kept: newest first). */
export function bucketEntries(entries: WhatsNewEntry[], v: Viewer): TabBucket[] {
  return WHATS_NEW_TABS.map((t) => ({
    ...t,
    entries: entries.filter((e) => (t.id === 'you' ? isForViewer(e, v) : entryTabs(e).includes(t.id))),
  })).filter((b) => b.entries.length > 0);
}

/** The tab to open: the asked-for one if it is shown, else 'For you' when there is one, else the first. */
export function pickTab(buckets: TabBucket[], asked: string | null | undefined): WhatsNewTab {
  if (asked && buckets.some((b) => b.id === asked)) return asked as WhatsNewTab;
  return (buckets.find((b) => b.id === 'you') ?? buckets.find((b) => b.id === 'everyone') ?? buckets[0])?.id ?? 'everyone';
}

/** Entries grouped under their date, in order. */
export function groupByDate(entries: WhatsNewEntry[]): { date: string; entries: WhatsNewEntry[] }[] {
  const out: { date: string; entries: WhatsNewEntry[] }[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && last.date === e.date) last.entries.push(e);
    else out.push({ date: e.date, entries: [e] });
  }
  return out;
}
