// Every clan-admin setting, as data, so "where do I change X?" has one answer.
//
// The admin area grew into a sidebar, two tabbed hubs (People, Clan settings), a long folded Discord
// page and per-event tabs. An admin looking for "the drops webhook" or "who gets pinged" had to know
// which of those it lived under. The search box in the admin shell (components/AdminSettingsSearch)
// reads this list and jumps straight there.
//
// PURE, and relative imports only: the shell's client component and a node:test suite both read it,
// and neither should need a database or the `@/` resolver. Who may SEE an entry is decided by the
// caller, which passes in a viewer built from lib/adminAccess — the same table the admin layout
// gates on — so this file never grows its own idea of who reaches what.
//
// THE RULE FOR ADDING TO IT: an entry points at a page that exists and says what is there. Something
// that is not built yet is either left out or described honestly as not built.

import { FEATURES, type FeatureKey } from './features.ts';
import { WEBHOOK_SECTIONS, groupLabel, searchTokens, type SettingField, type WebhookSection } from './webhookFields.ts';

/** Ranks below admin that some entries still need (the coffer is a treasurer's, not a moderator's). */
export type SettingRole = 'moderator' | 'treasurer' | 'admin' | 'owner';

export interface SettingEntry {
  /** Stable and unique — the React key and the test handle. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Synonyms people actually type: "webhook", "ping", "rank", "billing". */
  readonly keywords: readonly string[];
  /** A bare admin path (ClanLink adds the clan), optionally with a #anchor on that page. */
  readonly href: string;
  /** Where it lives, in the words of the sidebar: "Discord", "Clan settings", "People". */
  readonly section: string;
  /** A rank the page checks for itself beyond the path gate in lib/adminAccess. */
  readonly minRole?: SettingRole;
  /** Hidden when the clan has switched this module off (Clan settings → Features). */
  readonly feature?: FeatureKey;
  /** Lives on one event's page: the link goes to the events list and the description says which tab. */
  readonly needsEvent?: boolean;
}

// ── The catalogue ───────────────────────────────────────────────────────────────────────────────

const DISCORD = '/admin/integrations';

/** Pages and sections, written by hand from the pages themselves. */
const PAGES: readonly SettingEntry[] = [
  // Overview
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'What needs doing in the clan right now: setup steps, queues and upcoming events.',
    keywords: ['home', 'overview', 'checklist', 'todo'],
    href: '/admin/dashboard',
    section: 'Overview',
  },
  {
    id: 'setup',
    label: 'Setup wizard',
    description: 'Name the clan, connect Discord and bring members in from the game. Reopen it any time.',
    keywords: ['onboarding', 'getting started', 'wizard', 'first time', 'finish setup'],
    href: '/admin/setup',
    section: 'Settings',
  },

  // Events
  {
    id: 'events-all',
    label: 'All events',
    description: 'Every board and competition this clan runs. Open one to change its tiles, teams, sign-ups and posts.',
    keywords: ['bingo', 'boards', 'competitions', 'event list', 'manage events'],
    href: '/admin/events',
    section: 'Events',
  },
  {
    id: 'events-new',
    label: 'New event',
    description: 'Start a bingo, ladder, race or other format.',
    keywords: ['create event', 'create bingo', 'new board', 'make event', 'add event', 'format'],
    href: '/admin/events/new',
    section: 'Events',
  },
  {
    id: 'weekly-new',
    label: 'Schedule a competition',
    description: 'Skill or Boss of the Week: pick the skill or boss and the dates, and the whole roster is entered.',
    keywords: ['sotw', 'botw', 'skill of the week', 'boss of the week', 'weekly', 'competition', 'create'],
    href: '/admin/weekly',
    section: 'Events',
    feature: 'weekly',
  },
  {
    id: 'schedule',
    label: 'Schedule',
    description: 'The calendar of everything coming up, and what still needs dates.',
    keywords: ['calendar', 'dates', 'upcoming', 'timeline'],
    href: '/admin/schedule',
    section: 'Events',
  },
  {
    id: 'clan-events',
    label: 'Clan events',
    description: 'A boss mass, a hangout, a drop party: put it on the calendar and the bot announces it.',
    keywords: ['mass', 'hangout', 'calendar', 'social event', 'reminder', 'announce'],
    href: '/admin/clan-events',
    section: 'Events',
  },
  {
    id: 'proofs',
    label: 'Proofs to check',
    description: 'Flagged screenshots and submissions across every board, waiting for a moderator.',
    keywords: ['submissions', 'screenshots', 'flagged', 'verify', 'review', 'evidence'],
    href: '/admin/proofs',
    section: 'Events',
  },
  {
    id: 'tile-library',
    label: 'Task library',
    description: 'The task catalogue boards are built from, including updates from the shared Anvil library.',
    keywords: ['tiles', 'tasks', 'catalogue', 'templates', 'board builder'],
    href: '/admin/tile-library',
    section: 'Events',
  },

  // People
  {
    id: 'people-roster',
    label: 'Roster',
    description: 'Who is in the clan and who is asking to join. Add, rename or remove members.',
    keywords: ['members', 'people', 'join requests', 'clan list', 'add member'],
    href: '/admin/people',
    section: 'People',
  },
  {
    id: 'people-review',
    label: 'Needs review',
    description: 'Newcomers waiting to be confirmed, and ownership claims on characters.',
    keywords: ['verifications', 'verify', 'provisional', 'claims', 'pending', 'approve', 'newcomers'],
    href: '/admin/people/needs-review',
    section: 'People',
  },
  {
    id: 'people-staff',
    label: 'Staff & roles',
    description: 'Give someone a staff role, board-builder access, or hand over ownership.',
    keywords: ['roles', 'rank', 'permissions', 'moderator', 'admin', 'treasurer', 'editor', 'promote', 'transfer ownership', 'ban'],
    href: '/admin/people/staff',
    section: 'People',
    minRole: 'admin',
  },
  {
    id: 'access-visibility',
    label: 'Who can see this clan',
    description: 'Whether boards, roster and records are public or members-only.',
    keywords: ['privacy', 'private', 'public', 'visibility', 'access'],
    href: '/admin/people/access#access-visibility',
    section: 'People › Who can join',
    minRole: 'admin',
  },
  {
    id: 'access-guests',
    label: 'Players from other clans',
    description: 'Let guests play in your events without leaving their own clan.',
    keywords: ['guests', 'cross-clan', 'outsiders', 'admission', 'access'],
    href: '/admin/people/access#access-guests',
    section: 'People › Who can join',
    minRole: 'admin',
  },
  {
    id: 'access-listing',
    label: 'Clan listing',
    description: 'Whether this clan appears where people go looking for one.',
    keywords: ['discovery', 'directory', 'listed', 'recruiting', 'showcase'],
    href: '/admin/people/access#access-listing',
    section: 'People › Who can join',
    minRole: 'admin',
  },
  {
    id: 'guides',
    label: 'Guides',
    description: 'The clan’s copies of gear and boss guides, and updates waiting from the Anvil library.',
    keywords: ['gear', 'setups', 'content', 'library', 'strategy'],
    href: '/admin/guides',
    section: 'Clan',
  },
  {
    id: 'activity-log',
    label: 'Activity log',
    description: 'Who joined, left, changed what, and when.',
    keywords: ['audit', 'history', 'changes', 'log'],
    href: '/admin/clan/audit',
    section: 'Clan settings',
  },
  {
    id: 'announce',
    label: 'Post to Discord',
    description: 'Write an announcement here and the bot posts it in a channel.',
    keywords: ['announcement', 'news', 'message', 'broadcast', 'post'],
    href: '/admin/announce',
    section: 'Clan',
    minRole: 'admin',
    feature: 'announce',
  },

  // Money
  {
    id: 'coffer',
    label: 'Coffer',
    description: 'The clan’s gp: donations to confirm, prizes to send and every movement.',
    keywords: ['bank', 'gp', 'money', 'donations', 'treasury', 'ledger', 'balance'],
    href: '/admin/coffer',
    section: 'Money',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'coffer-donation',
    label: 'Record a donation',
    description: 'Log gp someone gave the clan.',
    keywords: ['donate', 'gp', 'coffer', 'money'],
    href: '/admin/coffer#coffer-record-donation',
    section: 'Money › Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'coffer-correct',
    label: 'Correct the coffer balance',
    description: 'Adjust the pot when it does not match what the clan actually holds.',
    keywords: ['adjust', 'pot', 'balance', 'fix', 'coffer', 'gp'],
    href: '/admin/coffer#coffer-correct',
    section: 'Money › Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'fees',
    label: 'Sign-up fees',
    description: 'Who has paid to enter each event, and confirming collected fees.',
    keywords: ['entry fee', 'payments', 'paid', 'unpaid', 'gp', 'money', 'collect'],
    href: '/admin/fees',
    section: 'Money',
    feature: 'fees',
  },

  // Plan
  {
    id: 'plan',
    label: 'Plan and billing',
    description: 'Your Anvil plan, member limit, and upgrading.',
    keywords: ['billing', 'subscription', 'pricing', 'payment', 'upgrade', 'member cap', 'limit', 'gumroad', 'premium'],
    href: '/admin/plan',
    section: 'Settings',
  },
  {
    id: 'anvil-updates',
    label: 'Anvil updates and news',
    description:
      'Get each new Anvil release (features, improvements, fixes) in your Discord: set the "Anvil updates channel" under Post without a bot. Or follow #anvil-announcements in the Anvil Discord. Every release is also on anvilosrs.com/changelog.',
    keywords: ['updates', 'release notes', 'changelog', 'deploys', 'deployment', 'new features', 'whats new', 'announcements', 'support'],
    href: '/admin/integrations#discord-by-hand',
    section: 'Settings',
  },

  // Clan settings → Profile
  {
    id: 'clan-name',
    label: 'Clan name',
    description: 'The display name, and the in-game clan name the plugin matches.',
    keywords: ['rename', 'title', 'in-game name', 'clan profile'],
    href: '/admin/clan#clan-name',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-image',
    label: 'Clan image',
    description: 'The crest or logo shown with your clan’s name.',
    keywords: ['logo', 'icon', 'avatar', 'crest', 'picture', 'clan profile'],
    href: '/admin/clan#clan-image',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-banner',
    label: 'Clan banner',
    description: 'The wide image across the top of your public clan page.',
    keywords: ['header', 'cover', 'image', 'gif', 'clan profile'],
    href: '/admin/clan#clan-banner',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-hook',
    label: 'Tagline and introduction',
    description: 'One line under your name and a longer introduction for strangers.',
    keywords: ['description', 'about', 'bio', 'hook', 'intro', 'clan profile'],
    href: '/admin/clan#clan-hook',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-tags',
    label: 'Clan focus tags',
    description: 'PvM, skilling, PvP, social, ironman: what the clan is about.',
    keywords: ['tags', 'focus', 'pvm', 'skilling', 'pvp', 'ironman', 'clan profile'],
    href: '/admin/clan#clan-tags',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-discovery',
    label: 'Recruiting and challenges',
    description: 'Whether you want more members, and whether other clans can challenge you.',
    keywords: ['discovery', 'recruiting', 'open', 'challenge', 'clan profile'],
    href: '/admin/clan#clan-discovery',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-requirements',
    label: 'Requirements to join',
    description: 'What a recruit needs, shown on your public clan page.',
    keywords: ['requirements', 'reqs', 'recruit', 'total level', 'clan profile'],
    href: '/admin/clan#clan-requirements',
    section: 'Clan settings › Profile',
    minRole: 'admin',
  },
  {
    id: 'clan-delete',
    label: 'Delete this clan',
    description: 'Remove the clan from Anvil. Only the owner sees the button.',
    keywords: ['remove', 'close', 'shut down', 'danger'],
    href: '/admin/clan#delete-clan',
    section: 'Clan settings › Profile',
    minRole: 'owner',
  },
  {
    id: 'features',
    label: 'Features',
    description: 'Switch whole modules on or off. Anything off is hidden for everyone; nothing is deleted.',
    keywords: ['modules', 'enable', 'disable', 'toggle', 'turn on', 'turn off'],
    href: '/admin/features',
    section: 'Clan settings',
  },

  // Clan settings → Rules & scoring
  {
    id: 'rules-house',
    label: 'House rules',
    description: 'Your clan’s rules in your words, shown by /bingo rules and the rules post.',
    keywords: ['rules', 'rulebook', 'cheating', 'screenshots', 'rules link'],
    href: '/admin/rules#house-rules',
    section: 'Clan settings › Rules & scoring',
  },
  {
    id: 'rules-fees',
    label: 'Fee sign-off',
    description: 'How many staff must confirm a paid entry fee, and settling fees when an event ends.',
    keywords: ['fees', 'confirmations', 'treasurer', 'settle', 'separation of duties'],
    href: '/admin/rules#fees',
    section: 'Clan settings › Rules & scoring',
  },
  {
    id: 'rules-scoring',
    label: 'Difficulty & balance',
    description: 'Difficulty tiers and the kill times and XP rates behind the board balance check.',
    keywords: ['tiers', 'points', 'scoring', 'balance rates', 'effort', 'kill times', 'xp rates'],
    href: '/admin/rules#scoring',
    section: 'Clan settings › Rules & scoring',
  },
  {
    id: 'rules-feeds',
    label: 'Lately feed & luck',
    description: 'What the clan’s Lately feed keeps, and which drops count on the Luck boards.',
    keywords: ['moments', 'feed', 'luck', 'loot value', 'gp threshold'],
    href: '/admin/rules#feeds',
    section: 'Clan settings › Rules & scoring',
  },

  // Discord
  {
    id: 'discord',
    label: 'Discord',
    description: 'Everything Anvil does in your server: the bot, channels, posts, roles and commands.',
    keywords: ['integrations', 'bot', 'server', 'webhooks', 'channels', 'announcements'],
    href: DISCORD,
    section: 'Discord',
  },
  {
    id: 'discord-connection',
    label: 'Bot connection',
    description: 'Invite the bot, its name and avatar, its language, and the Discord invite link shown on your site.',
    keywords: ['bot', 'invite', 'token', 'language', 'identity', 'avatar', 'invite link', 'connect'],
    href: `${DISCORD}#discord-connection`,
    section: 'Discord',
  },
  {
    id: 'discord-feeds',
    label: 'What goes where',
    description: 'Every kind of post: on or off, and which channel it lands in.',
    keywords: ['channels', 'routing', 'webhooks', 'posts', 'notifications', 'feeds', 'announcements'],
    href: `${DISCORD}#discord-feeds`,
    section: 'Discord',
  },
  {
    id: 'discord-game-modes',
    label: 'Game mode channels',
    description: 'Leagues, Deadman, hardcore and other modes each get their own channel. Under What goes where → Game modes.',
    keywords: ['leagues', 'deadman', 'dmm', 'hardcore', 'seasonal', 'worlds', 'modes'],
    href: `${DISCORD}#discord-feeds`,
    section: 'Discord › What goes where',
  },
  {
    id: 'discord-drop-filters',
    label: 'Drop filters',
    description: 'How rare a drop must be to post, items that always post, kill counts and guaranteed drops.',
    keywords: ['rarity', 'drops', 'loot', 'threshold', 'always post', 'value', 'rare'],
    href: `${DISCORD}#discord-feeds`,
    section: 'Discord › What goes where',
  },
  {
    id: 'discord-level-filters',
    label: 'Level milestones',
    description: 'Which level-ups and XP milestones post.',
    keywords: ['levels', '99', 'xp', 'milestones', 'skills'],
    href: `${DISCORD}#discord-feeds`,
    section: 'Discord › What goes where',
  },
  {
    id: 'discord-fun-lines',
    label: 'Death and lucky-drop lines',
    description: 'One-liners added to deaths and lucky drops. Needs Death & fun messages switched on.',
    keywords: ['fun', 'taunts', 'jokes', 'deaths', 'spoon', 'messages'],
    href: `${DISCORD}#discord-feeds`,
    section: 'Discord › What goes where',
    feature: 'funMessages',
  },
  {
    id: 'discord-event-posts',
    label: 'Event post defaults',
    description: 'Which event posts go out by default, who they ping, the player role and channel cleanup.',
    keywords: ['event posts', 'pings', 'mentions', 'player role', 'cleanup', 'defaults', 'announcements'],
    href: `${DISCORD}#discord-event-posts`,
    section: 'Discord',
  },
  {
    id: 'discord-roles',
    label: 'Roles & nicknames',
    description: 'The role pinged for big news, syncing Discord roles and nicknames, and rank rules.',
    keywords: ['roles', 'role sync', 'nicknames', 'rank', 'ranks', 'ping', 'mention', 'rank rules'],
    href: `${DISCORD}#discord-roles`,
    section: 'Discord',
  },
  {
    id: 'discord-team-channels',
    label: 'Team channels',
    description: 'A private voice and text channel for each team during an event.',
    keywords: ['teams', 'voice', 'private channels', 'category'],
    href: `${DISCORD}#discord-team-channels`,
    section: 'Discord',
  },
  {
    id: 'discord-clan-hall',
    label: 'Clan Hall card',
    description: 'Shows who’s online in your Discord on your public clan page.',
    keywords: ['widget', 'online', 'presence', 'clan hall'],
    href: `${DISCORD}#discord-clan-hall`,
    section: 'Discord',
    feature: 'clanHall',
  },
  {
    id: 'discord-commands',
    label: 'Slash commands',
    description: 'Switch off any bot command your server doesn’t need.',
    keywords: ['commands', 'slash', '/bingo', 'bot commands'],
    href: `${DISCORD}#discord-commands`,
    section: 'Discord',
  },
  {
    id: 'discord-by-hand',
    label: 'Post without a bot',
    description: 'Paste a channel’s webhook link instead of using the bot. Also guests’ posts and the Leagues icon.',
    keywords: ['webhooks', 'webhook url', 'manual', 'no bot', 'paste'],
    href: `${DISCORD}#discord-by-hand`,
    section: 'Discord',
  },

  // Per-event tabs. They need an event, so they land on the list with a hint.
  ...(
    [
      ['tiles', 'Event tiles', 'Open an event, then Tiles: add, edit and balance the board’s tasks.', ['tasks', 'board', 'squares', 'points']],
      ['teams', 'Event teams & draft', 'Open an event, then Teams & Draft: teams, captains, the draft and team staff.', ['captains', 'draft', 'roster', 'team channels', 'sub']],
      ['signups', 'Event sign-ups', 'Open an event, then Sign-ups: approve players, sign-up questions and fees.', ['registration', 'join', 'applications', 'questions', 'entry fee']],
      ['stats', 'Event stats', 'Open an event, then Stats: standings, gains and baselines.', ['standings', 'leaderboard', 'progress', 'baselines']],
      ['prizes', 'Event prizes & payouts', 'Open an event, then Prizes: the pot, places and who gets paid.', ['payouts', 'prize pool', 'pot', 'rewards', 'winners']],
      ['discord', 'Event Discord posts', 'Open an event, then Discord: which posts this event sends, where, and who they ping.', ['announcements', 'channel', 'webhook', 'ping', 'roles', 'rulebook']],
      ['settings', 'Event settings', 'Open an event, then Settings: dates, visibility, who can enter, co-hosts and editors.', ['dates', 'visibility', 'co-host', 'editors', 'rules', 'rename']],
      ['survey', 'Event survey', 'Open an event, then Survey: questions players answer once it ends.', ['feedback', 'questions', 'poll']],
    ] as const
  ).map(([slug, label, description, kw]): SettingEntry => ({
    id: `event-${slug}`,
    label,
    description,
    keywords: ['event', 'bingo', ...kw],
    href: '/admin/events',
    section: 'Event pages',
    needsEvent: true,
    ...(slug === 'survey' ? { feature: 'survey' as const } : {}),
  })),

  // Personal, not clan: lives on the profile.
  {
    id: 'profile-announcements',
    label: 'Your own announcements',
    description:
      'Where your own drops, pets and deaths are announced across every clan, and your personal Discord webhooks. On your profile, and only shown once you have a character.',
    keywords: ['personal', 'my announcements', 'my webhooks', 'webhook', 'opt out', 'emissions', 'profile', 'notifications'],
    href: '/profile#announcements',
    section: 'Your profile',
  },
];

/** Webhook settings whose bot-routed twin lives in "What goes where". */
const FEED_ROUTED = new Set([
  'discord_webhook_url',
  'webhook_plugin_default',
  'discord_webhook_bingo',
  'discord_webhook_cohost',
  'discord_webhook_weekly',
  'discord_webhook_clan_events',
  'discord_webhook_roster',
  'discord_webhook_signups',
  'discord_webhook_coffer',
  'webhook_rare_drops',
  'webhook_pets',
  'webhook_deaths',
  'webhook_combat_achievements',
  'webhook_levels',
  'webhook_quests',
  'webhook_diaries',
  'webhook_collection_log',
  'webhook_pvp_kills',
]);

const KIND_WORDS: Record<SettingField['kind'], readonly string[]> = {
  webhook: ['webhook', 'channel', 'discord', 'notifications', 'announcements', 'posts'],
  plain: ['discord'],
  toggle: ['discord', 'toggle'],
};

/** One entry per Discord destination, straight off lib/webhookFields so a new field is searchable at once. */
function webhookEntries(): SettingEntry[] {
  const sections: readonly WebhookSection[] = WEBHOOK_SECTIONS;
  return sections.flatMap((section) =>
    section.fields.map((field): SettingEntry => {
      const routed = FEED_ROUTED.has(field.key);
      return {
        id: `webhook-${field.key}`,
        // The main channel's field is just "Channel" on its page; out of context it needs its section.
        label: field.label === 'Channel' ? section.title : field.label,
        description: field.help,
        keywords: [...KIND_WORDS[field.kind], field.key, section.title, groupLabel(section.group)],
        // With the bot, a channel is picked under What goes where; the pasted-link field is the fallback.
        href: `${DISCORD}#${routed ? 'discord-feeds' : 'discord-by-hand'}`,
        section: routed ? 'Discord › What goes where' : 'Discord › Post without a bot',
        ...(field.key === 'discord_webhook_coffer' ? { feature: 'coffer' as const } : {}),
      };
    }),
  );
}

/** One per module switch on Clan settings → Features. */
function featureEntries(): SettingEntry[] {
  return FEATURES.map((f) => ({
    id: `feature-${f.key}`,
    label: `${f.name} on/off`,
    description: f.what,
    keywords: ['feature', 'enable', 'disable', 'switch', 'toggle', f.group],
    href: `/admin/features#feature-${f.key}`,
    section: 'Clan settings › Features',
  }));
}

export const ADMIN_SETTINGS: readonly SettingEntry[] = [...PAGES, ...featureEntries(), ...webhookEntries()];

// ── Who sees what ───────────────────────────────────────────────────────────────────────────────

export interface SettingsViewer {
  /** Whether the admin gate lets this viewer open a path — built from lib/adminAccess `redirectFor`. */
  canReach(path: string): boolean;
  hasRole(min: SettingRole): boolean;
  featureOn(key: FeatureKey): boolean;
}

/** The path part of an href: no #anchor, no ?query. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

export function canSeeSetting(entry: SettingEntry, viewer: SettingsViewer): boolean {
  if (entry.minRole && !viewer.hasRole(entry.minRole)) return false;
  if (entry.feature && !viewer.featureOn(entry.feature)) return false;
  // Only admin paths are gated by the admin table; /profile is everyone's own.
  const path = pathOf(entry.href);
  return !path.startsWith('/admin') || viewer.canReach(path);
}

export function visibleSettings(viewer: SettingsViewer, entries: readonly SettingEntry[] = ADMIN_SETTINGS): SettingEntry[] {
  return entries.filter((e) => canSeeSetting(e, viewer));
}

// ── Matching ────────────────────────────────────────────────────────────────────────────────────

/** "webhooks" should find "webhook": drop one trailing s from longer query words. */
function stem(term: string): string {
  return term.length > 3 && term.endsWith('s') && !term.endsWith('ss') ? term.slice(0, -1) : term;
}

const LABEL_START = 40;
const LABEL_WORD = 30;
const KEYWORD = 20;
const DESCRIPTION = 10;
const WHOLE_LABEL_PREFIX = 50;

/**
 * How well one entry answers the query, or 0 when it does not. EVERY word has to hit somewhere, so
 * more words narrow; each word scores by the best place it hit (label start > label word > keyword >
 * description), so an entry NAMED by the query outranks one that merely mentions it.
 */
export function scoreSetting(entry: SettingEntry, query: string): number {
  const terms = searchTokens(query).map(stem);
  if (terms.length === 0) return 0;
  const label = searchTokens(entry.label);
  const keywords = searchTokens(entry.keywords.join(' '));
  const description = searchTokens(`${entry.description} ${entry.section}`);
  const hit = (words: string[], t: string) => words.some((w) => w.startsWith(t));

  let score = 0;
  for (const t of terms) {
    const best =
      label[0]?.startsWith(t) ? LABEL_START
      : hit(label, t) ? LABEL_WORD
      : hit(keywords, t) ? KEYWORD
      : hit(description, t) ? DESCRIPTION
      : 0;
    if (best === 0) return 0;
    score += best;
  }
  if (label.join(' ').startsWith(terms.join(' '))) score += WHOLE_LABEL_PREFIX;
  return score;
}

/** Entries matching every word of the query, best first; ties keep catalogue order. Empty query → none. */
export function searchSettings(
  query: string,
  entries: readonly SettingEntry[] = ADMIN_SETTINGS,
  limit = 20,
): SettingEntry[] {
  return entries
    .map((entry, i) => ({ entry, i, score: scoreSetting(entry, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.entry);
}
