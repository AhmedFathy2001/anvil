// Every clan-admin setting, as data, so "where do I change X?" has one answer.
//
// The admin area grew into a sidebar, two tabbed hubs (People, Clan settings), a long folded Discord
// page and per-event tabs. An admin looking for "the drops webhook" or "keep deaths in the feed" had
// to know which of those it lived under. The search box in the admin shell
// (app/admin/_components/AdminSettingsSearch) reads this list and jumps straight there, opened and
// ringed (components/HashReveal).
//
// ONE ENTRY PER SETTING, not per page: the line an admin is looking for is a field ("Keep deaths
// too"), a switch ("Send game-mode posts to their own channels") or a card ("Remove Dink's old
// webhooks"), and a result that only names the page leaves them reading it top to bottom again.
//
// PURE, and relative imports only: the shell's client component and a node:test suite both read it,
// and neither should need a database or the `@/` resolver. Who may SEE an entry is decided by the
// caller, which passes in a viewer built from lib/adminAccess — the same table the admin layout
// gates on — so this file never grows its own idea of who reaches what.
//
// THE RULE FOR ADDING TO IT: an entry points at a page that exists and says what is there, and its
// #anchor is an id that page renders (tests/admin-settings-search checks both). Something that is
// not built yet is either left out or described honestly as not built.

import { TOGGLEABLE_COMMANDS } from './discordCommandToggles.ts';
import { DISCORD_FEEDS, FEED_TABS, type FeedTab } from './discordFeeds.ts';
import { DISCORD_POST_TYPES, POST_GROUPS } from './discordPostPolicy.ts';
import { SETTINGS_INDEX, tabsFor, type SettingsKind, type SettingsTab } from './eventSettingsTabs.ts';
import { FEATURES, type FeatureKey } from './features.ts';
import { WEBHOOK_SECTIONS, groupLabel, type SettingField, type WebhookSection } from './webhookFields.ts';
import { WORLD_MODES } from './worldModes.ts';

/** Ranks below admin that some entries still need (the coffer is a treasurer's, not a moderator's). */
export type SettingRole = 'moderator' | 'treasurer' | 'admin' | 'owner';

export interface SettingEntry {
  /** Stable and unique — the React key and the test handle. */
  readonly id: string;
  readonly label: string;
  readonly description: string;
  /** Synonyms people actually type: "webhook", "ping", "rank", "billing", "rip". */
  readonly keywords: readonly string[];
  /** A bare site path (ClanLink adds the clan), optionally with a #anchor on that page. */
  readonly href: string;
  /** Where it lives, as a breadcrumb in the sidebar's words: "Clan settings → Rules & scoring". */
  readonly section: string;
  /** A rank the page checks for itself beyond the path gate in lib/adminAccess. */
  readonly minRole?: SettingRole;
  /** Hidden when the clan has switched this module off (Clan settings → Features). */
  readonly feature?: FeatureKey;
  /**
   * Lives on one event's page. `href` is the events list (with the description saying which tab);
   * opened from inside an event, the search goes to that event's `eventPath` instead.
   */
  readonly needsEvent?: boolean;
  /** With needsEvent: the page under /admin/events/<id>/ — 'settings/board#reveal', 'discord#event-chat'. */
  readonly eventPath?: string;
  /** With needsEvent: a weekly competition's page (/admin/events/weekly/<id>/…) rather than a board's. */
  readonly weekly?: boolean;
  /** Only this kind of place has it: an in-game clan, or a creator space. */
  readonly only?: 'clan' | 'space';
  /** Tried when `href`'s anchor never renders (a card that shows only sometimes). */
  readonly fallbackAnchor?: string;
  /** A section of a public guide rather than a setting — listed below the settings. */
  readonly guide?: boolean;
}

// ── The catalogue ───────────────────────────────────────────────────────────────────────────────

const DISCORD = '/admin/integrations';
const RULES = '/admin/rules';
const CLAN = '/admin/clan';
const SPACE = '/admin/space';
const BOOSTS = '/admin/clan/boosts';

const S = {
  rules: 'Clan settings → Rules & scoring',
  profile: 'Clan settings → Profile',
  boosts: 'Clan settings → Boosts',
  features: 'Clan settings → Features',
  space: 'Space settings',
  feeds: 'Discord → What goes where',
  modes: 'Discord → What goes where → Game modes',
  byHand: 'Discord → Post without a bot',
  quick: 'Discord → Quick setup',
} as const;

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
    keywords: ['mass', 'hangout', 'calendar', 'social event', 'reminder', 'announce', 'drop party'],
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
    keywords: ['tiles', 'tasks', 'catalogue', 'templates', 'board builder', 'starter tasks', 'import'],
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
    keywords: ['verifications', 'verify', 'provisional', 'claims', 'pending', 'approve', 'newcomers', 'not our member'],
    href: '/admin/people/needs-review',
    section: 'People',
  },
  {
    id: 'people-staff',
    label: 'Staff & roles',
    description: 'Give someone a staff role, board-builder or guide-writer access, or hand over ownership.',
    keywords: ['roles', 'rank', 'permissions', 'moderator', 'admin', 'treasurer', 'editor', 'promote', 'transfer ownership', 'ban', 'make owner', 'guide writer'],
    href: '/admin/people/staff',
    section: 'People',
    minRole: 'admin',
  },
  {
    id: 'people-viewers',
    label: 'Past viewers',
    description: 'Viewers who played from your stream, by event: their team and how it finished. Make one a guest.',
    keywords: ['viewers', 'stream', 'twitch', 'kick', 'guests', 'make guest'],
    href: '/admin/people/viewers',
    section: 'People',
    minRole: 'moderator',
  },
  {
    id: 'access-visibility',
    label: 'Who can see this clan',
    description: 'Whether boards, roster and records are public or members-only.',
    keywords: ['privacy', 'private', 'public', 'visibility', 'access', 'members only'],
    href: '/admin/people/access#access-visibility',
    section: 'People → Who can join',
    minRole: 'admin',
  },
  {
    id: 'access-guests',
    label: 'Players from other clans',
    description: 'Let guests play in your events without leaving their own clan: ask first, anyone, or no guests.',
    keywords: ['guests', 'cross-clan', 'outsiders', 'admission', 'access', 'other clans'],
    href: '/admin/people/access#access-guests',
    section: 'People → Who can join',
    minRole: 'admin',
  },
  {
    id: 'access-listing',
    label: 'Clan listing',
    description: 'Whether this clan appears in the Clan Hall, where people go looking for one.',
    keywords: ['discovery', 'directory', 'listed', 'recruiting', 'showcase', 'clan hall'],
    href: '/admin/people/access#access-listing',
    section: 'People → Who can join',
    minRole: 'admin',
  },
  {
    id: 'guides',
    label: 'Guides',
    description: 'The clan’s copies of gear and boss guides, updates from the Anvil library, and posting them to Discord.',
    keywords: ['gear', 'setups', 'content', 'library', 'strategy', 'categories', 'new guide'],
    href: '/admin/guides',
    section: 'Clan',
  },
  {
    id: 'activity-log',
    label: 'Activity log',
    description: 'Who joined, left, changed what, and when.',
    keywords: ['audit', 'history', 'changes', 'log', 'who changed'],
    href: '/admin/clan/audit',
    section: 'Clan settings',
  },
  {
    id: 'announce',
    label: 'Post to Discord',
    description: 'Write an announcement here and the bot posts it in a channel. Edit or delete it afterwards.',
    keywords: ['announcement', 'news', 'message', 'broadcast', 'post', 'embed', 'everyone'],
    href: '/admin/announce',
    section: 'Clan',
    minRole: 'admin',
    feature: 'announce',
  },
  {
    id: 'announce-channel',
    label: 'Announcement channel and ping',
    description: 'Pick the channel, then who it pings: nobody, @everyone or a role.',
    keywords: ['announce', 'channel', 'ping', 'mention', 'everyone', 'role'],
    href: '/admin/announce#announce-channel',
    section: 'Clan → Post to Discord',
    minRole: 'admin',
    feature: 'announce',
  },
  {
    id: 'announce-embed',
    label: 'Send as an embed',
    description: 'A titled card with an accent colour instead of plain text.',
    keywords: ['embed', 'colour', 'color', 'title', 'accent', 'announce'],
    href: '/admin/announce#announce-options',
    section: 'Clan → Post to Discord',
    minRole: 'admin',
    feature: 'announce',
  },
  {
    id: 'announce-sent',
    label: 'Edit or delete a sent announcement',
    description: 'Everything sent from here: fix a typo or take it down. Editing never pings again.',
    keywords: ['edit announcement', 'delete announcement', 'typo', 'sent', 'history', 'announce'],
    href: '/admin/announce#announce-sent',
    section: 'Clan → Post to Discord',
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
    id: 'coffer-confirm',
    label: 'Donations to confirm',
    description: 'Donations members filed, waiting for a treasurer to confirm or reject.',
    keywords: ['pending', 'confirm', 'reject', 'donation', 'coffer'],
    href: '/admin/coffer#coffer-to-confirm',
    section: 'Money → Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'coffer-prizes',
    label: 'Prizes to send',
    description: 'Prizes promised out of the coffer: mark one sent, or cancel it.',
    keywords: ['payout', 'prize', 'sent it', 'owed', 'coffer', 'pay'],
    href: '/admin/coffer#coffer-prizes',
    section: 'Money → Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'coffer-donation',
    label: 'Record a donation',
    description: 'Log gp someone gave the clan, or several people chipping in together.',
    keywords: ['donate', 'gp', 'coffer', 'money', 'chipped in', 'split'],
    href: '/admin/coffer#coffer-record-donation',
    section: 'Money → Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'coffer-correct',
    label: 'Correct the coffer balance',
    description: 'Adjust the pot when it does not match what the clan actually holds.',
    keywords: ['adjust', 'pot', 'balance', 'fix', 'coffer', 'gp', 'take out'],
    href: '/admin/coffer#coffer-correct',
    section: 'Money → Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'coffer-ledger',
    label: 'Coffer ledger',
    description: 'Every gp that has moved in or out, newest first.',
    keywords: ['history', 'movements', 'ledger', 'coffer', 'transactions'],
    href: '/admin/coffer#coffer-ledger',
    section: 'Money → Coffer',
    minRole: 'treasurer',
    feature: 'coffer',
  },
  {
    id: 'fees',
    label: 'Sign-up fees',
    description: 'Who has paid to enter each event: remind the unpaid, confirm collected fees, close a board out.',
    keywords: ['entry fee', 'payments', 'paid', 'unpaid', 'gp', 'money', 'collect', 'remind', 'close out'],
    href: '/admin/fees',
    section: 'Money',
    feature: 'fees',
  },

  // Plan
  {
    id: 'plan',
    label: 'Plan and billing',
    description: 'Your Anvil plan, member limit, invoices and upgrading.',
    keywords: ['billing', 'subscription', 'pricing', 'payment', 'upgrade', 'member cap', 'limit', 'gumroad', 'premium', 'invoice', 'cancel'],
    href: '/admin/plan',
    section: 'Settings',
  },
  {
    id: 'plan-usage',
    label: 'Members against your plan’s cap',
    description: 'How many members you have, and how many your plan allows.',
    keywords: ['member cap', 'limit', 'how many members', 'full', 'usage', 'seats'],
    href: '/admin/plan#plan-usage',
    section: 'Settings → Plan and billing',
    only: 'clan',
  },
  {
    id: 'anvil-updates',
    label: 'Anvil updates and news',
    description:
      'Get each new Anvil release (features, improvements, fixes) in your Discord: set the "Anvil updates channel" under Post without a bot. Or follow #anvil-announcements in the Anvil Discord. Every release is also on anvilosrs.com/changelog.',
    keywords: ['updates', 'release notes', 'changelog', 'deploys', 'deployment', 'new features', 'whats new', 'announcements', 'support'],
    href: `${DISCORD}#setting-discord_webhook_anvil_updates`,
    section: 'Settings',
    fallbackAnchor: 'discord-by-hand',
  },
  {
    id: 'anvil-discord',
    label: 'Anvil support Discord',
    description: 'Ask the Anvil team and other clans, report a bug, follow releases.',
    keywords: ['support', 'help', 'bug', 'contact', 'anvil discord'],
    href: '/admin/plan#anvil-discord',
    section: 'Settings → Plan and billing',
    only: 'clan',
  },

  // Clan settings → Profile
  {
    id: 'clan-name',
    label: 'Clan name',
    description: 'The display name, and the in-game clan name the plugin matches.',
    keywords: ['rename', 'title', 'in-game name', 'clan profile', 'display name'],
    href: `${CLAN}#clan-name`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-image',
    label: 'Clan image',
    description: 'The crest or logo shown with your clan’s name.',
    keywords: ['logo', 'icon', 'avatar', 'crest', 'picture', 'clan profile'],
    href: `${CLAN}#clan-image`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-banner',
    label: 'Clan banner',
    description: 'The wide image across the top of your public clan page. Animated banners play from Boost Level 2.',
    keywords: ['header', 'cover', 'image', 'gif', 'animated', 'clan profile'],
    href: `${CLAN}#clan-banner`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-hook',
    label: 'Tagline and introduction',
    description: 'One line under your name and a longer introduction for strangers.',
    keywords: ['description', 'about', 'bio', 'hook', 'intro', 'clan profile'],
    href: `${CLAN}#clan-hook`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-tags',
    label: 'Clan focus tags',
    description: 'PvM, skilling, PvP, social, ironman: what the clan is about.',
    keywords: ['tags', 'focus', 'pvm', 'skilling', 'pvp', 'ironman', 'clan profile'],
    href: `${CLAN}#clan-tags`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-discovery',
    label: 'Recruiting and challenges',
    description: 'Whether you want more members, and whether other clans can challenge you to a co-hosted event.',
    keywords: ['discovery', 'recruiting', 'open', 'challenge', 'clan vs clan', 'clan profile'],
    href: `${CLAN}#clan-discovery`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-requirements',
    label: 'Requirements to join',
    description: 'Total level, EHP, region and timezone a recruit needs, shown on your public clan page.',
    keywords: ['requirements', 'reqs', 'recruit', 'total level', 'ehp', 'region', 'timezone', 'clan profile'],
    href: `${CLAN}#clan-requirements`,
    section: S.profile,
    minRole: 'admin',
  },
  {
    id: 'clan-colours',
    label: 'Accent colour',
    description: 'The colour your clan’s pages use, picked from your logo and banner or typed in.',
    keywords: ['colour', 'color', 'accent', 'theme', 'look', 'hex', 'brand'],
    href: `${CLAN}#colours`,
    section: S.profile,
    minRole: 'admin',
    only: 'clan',
  },
  {
    id: 'clan-streaming',
    label: 'Streaming',
    description: 'Let viewers join your events from your stream, and connect Twitch, YouTube or Kick.',
    keywords: ['stream', 'streaming', 'twitch', 'kick', 'youtube', 'viewers', 'streamer'],
    href: `${CLAN}#streaming`,
    section: S.profile,
    minRole: 'admin',
    only: 'clan',
  },
  {
    id: 'clan-delete',
    label: 'Delete this clan',
    description: 'Remove the clan from Anvil. Only the owner sees the button.',
    keywords: ['remove', 'close', 'shut down', 'danger'],
    href: `${CLAN}#delete-clan`,
    section: S.profile,
    minRole: 'owner',
    only: 'clan',
  },
  {
    id: 'features',
    label: 'Features',
    description: 'Switch whole modules on or off. Anything off is hidden for everyone; nothing is deleted.',
    keywords: ['modules', 'enable', 'disable', 'toggle', 'turn on', 'turn off'],
    href: '/admin/features',
    section: 'Clan settings',
  },

  // Clan settings → Boosts
  {
    id: 'boosts',
    label: 'Clan boosts',
    description: 'Members who are Supporters can boost the clan. See its level, who boosts it, and what each level unlocks.',
    keywords: ['boost', 'boosts', 'boosted', 'level', 'nitro', 'supporter', 'champion', 'perks', 'unlock', 'boosters'],
    href: `${BOOSTS}#boost-level`,
    section: S.boosts,
    minRole: 'admin',
    only: 'clan',
  },
  {
    id: 'boost-recruiting-line',
    label: 'Recruiting line',
    description: 'One sentence for visitors on your clan page and Clan Hall card. Unlocks at Boost Level 2.',
    keywords: ['boost', 'recruiting', 'recruit', 'tagline', 'clan hall', 'level 2'],
    href: `${BOOSTS}#boost-recruiting-line`,
    section: S.boosts,
    minRole: 'admin',
    only: 'clan',
  },
  {
    id: 'boost-recruitment-post',
    label: 'Recruitment post in the Anvil Discord',
    description: 'Once a month, post your clan in the Anvil Discord’s recruiting channel. Unlocks at Boost Level 3.',
    keywords: ['boost', 'recruitment post', 'recruiting', 'advertise', 'anvil discord', 'level 3', 'monthly'],
    href: `${BOOSTS}#boost-recruitment-post`,
    section: S.boosts,
    minRole: 'admin',
    only: 'clan',
  },

  // Streaming bits shared by a clan's profile and a space's settings.
  ...(
    [
      ['twitch-channel', 'Twitch channel', 'Connect Twitch so events can be for your followers or subs.', ['twitch', 'followers', 'subs', 'connect', 'stream']],
      ['youtube-channel', 'YouTube channel', 'Connect YouTube so events can be for your subscribers or members.', ['youtube', 'subscribers', 'members', 'connect', 'stream']],
      ['kick-channel', 'Kick channel', 'Connect Kick, followers-only chat, and !join in Kick chat.', ['kick', 'followers', 'subs', 'connect', 'stream', 'join']],
      ['stream-highlights', 'Stream highlights', 'Auto-clip big moments on your stream, and whether Anvil may feature them.', ['clips', 'auto clip', 'highlights', 'twitch', 'youtube', 'promotion']],
      ['chat-join', '!join in Twitch chat', 'The bot answers !join in your chat with the open event’s link.', ['join', 'chat bot', 'twitch chat', 'command', 'stream']],
      ['overlay-mark', 'Anvil mark on your overlay', 'Hide the small Anvil badge on your OBS overlay.', ['overlay', 'obs', 'badge', 'watermark', 'powered by', 'stream']],
    ] as const
  ).flatMap(([anchor, label, description, kw]): SettingEntry[] => [
    {
      id: `clan-${anchor}`,
      label,
      description: `${description} Shown once Streaming is on.`,
      keywords: [...kw],
      href: `${CLAN}#${anchor}`,
      section: `${S.profile} → Streaming`,
      minRole: 'admin',
      only: 'clan',
      fallbackAnchor: 'streaming',
    },
    {
      id: `space-${anchor}`,
      label,
      description,
      keywords: [...kw],
      href: `${SPACE}#${anchor}`,
      section: S.space,
      minRole: 'admin',
      only: 'space',
      fallbackAnchor: 'channels',
    },
  ]),

  // Space settings (a creator space's own page)
  {
    id: 'space-settings',
    label: 'Space settings',
    description: 'Your space’s name, channels, page, colours and listing.',
    keywords: ['settings', 'space', 'profile', 'creator'],
    href: SPACE,
    section: 'Your space',
    minRole: 'admin',
    only: 'space',
  },
  {
    id: 'space-name',
    label: 'Space name',
    description: 'The name your viewers see on your page and events.',
    keywords: ['rename', 'name', 'title', 'space'],
    href: `${SPACE}#your-space`,
    section: S.space,
    minRole: 'admin',
    only: 'space',
  },
  {
    id: 'space-advertise',
    label: 'Advertise on Anvil',
    description: 'List your space among Anvil’s creators; new events start listed.',
    keywords: ['listing', 'listed', 'directory', 'discover', 'public', 'advertise'],
    href: `${SPACE}#advertise`,
    section: S.space,
    minRole: 'admin',
    only: 'space',
  },
  ...(
    [
      ['page-bio', 'Bio', 'A few lines about you on your public page.', ['about', 'bio', 'description', 'your page']],
      ['page-logo', 'Logo and banner', 'Your logo, and the banner across the top of your page.', ['logo', 'banner', 'avatar', 'image', 'gif', 'your page']],
      ['page-panels', 'Panels', 'Cards under your events: a title, text, a picture and a link.', ['panels', 'cards', 'links', 'your page']],
      ['page-schedule', 'Stream schedule', 'When you usually go live, shown on each visitor’s own clock.', ['schedule', 'times', 'when live', 'timezone', 'your page']],
      ['page-featured', 'Featured clip', 'One clip pinned to the top of your page.', ['featured', 'clip', 'pinned', 'highlight', 'your page']],
    ] as const
  ).map(([anchor, label, description, kw]): SettingEntry => ({
    id: `space-${anchor}`,
    label,
    description,
    keywords: [...kw],
    href: `${SPACE}#${anchor}`,
    section: `${S.space} → Your page`,
    minRole: 'admin',
    only: 'space',
  })),
  {
    id: 'space-colours',
    label: 'Accent colour',
    description: 'The colour your space’s pages use, picked from your art or typed in.',
    keywords: ['colour', 'color', 'accent', 'theme', 'look', 'hex', 'brand'],
    href: `${SPACE}#colours`,
    section: S.space,
    minRole: 'admin',
    only: 'space',
  },
  {
    id: 'space-delete',
    label: 'Delete this space',
    description: 'Remove the space from Anvil. Only the owner sees the button.',
    keywords: ['remove', 'close', 'danger'],
    href: `${SPACE}#delete-clan`,
    section: S.space,
    minRole: 'owner',
    only: 'space',
  },

  // Clan settings → Rules & scoring
  {
    id: 'rules-house',
    label: 'House rules',
    description: 'Your clan’s rules in your words, shown by /bingo rules and the rules post, plus a link to the full rules.',
    keywords: ['rules', 'rulebook', 'cheating', 'screenshots', 'rules link'],
    href: `${RULES}#house-rules`,
    section: S.rules,
  },
  {
    id: 'rules-fees',
    label: 'Fee sign-off',
    description: 'How many staff must confirm a paid entry fee, and settling fees when an event ends.',
    keywords: ['fees', 'confirmations', 'treasurer', 'settle', 'separation of duties', 'second signature'],
    href: `${RULES}#fees`,
    section: S.rules,
  },
  {
    id: 'rules-scoring',
    label: 'Difficulty & balance',
    description: 'Difficulty tiers and the kill times and XP rates behind the board balance check.',
    keywords: ['tiers', 'points', 'scoring', 'balance rates', 'effort', 'kill times', 'xp rates', 'tier bands'],
    href: `${RULES}#scoring`,
    section: S.rules,
  },
  {
    id: 'rules-feeds',
    label: 'Lately feed & luck',
    description: 'What the clan’s Lately feed keeps, and which drops count on the Luck boards.',
    keywords: ['moments', 'feed', 'luck', 'loot value', 'gp threshold', 'lately'],
    href: `${RULES}#feeds`,
    section: S.rules,
  },
  {
    id: 'rules-feed-deaths',
    label: 'Keep deaths too',
    description: 'Whether deaths are kept in the clan’s Lately feed (under its Deaths tab, never in All). On by default.',
    keywords: ['death', 'deaths', 'died', 'dying', 'keep deaths', 'rip', 'dead', 'feed', 'moments', 'lately'],
    href: `${RULES}#setting-moments_clan_deaths`,
    section: `${S.rules} → Lately feed & luck`,
    only: 'clan',
  },
  {
    id: 'rules-feed-loot',
    label: 'Keep drops worth at least (gp)',
    description: 'The gp floor for drops in the Lately feed. Genuinely rare drops are kept whatever they are worth.',
    keywords: ['loot', 'drops', 'gp floor', 'value', 'threshold', 'minimum', 'feed', 'moments', 'lately', '5m'],
    href: `${RULES}#setting-moments_clan_min_loot_gp`,
    section: `${S.rules} → Lately feed & luck`,
    only: 'clan',
  },
  {
    id: 'rules-feed-ca',
    label: 'Keep combat tasks from tier',
    description: 'Which combat achievement tiers the Lately feed keeps. Master by default.',
    keywords: ['combat achievements', 'ca', 'combat tasks', 'tier', 'master', 'grandmaster', 'elite', 'feed', 'moments'],
    href: `${RULES}#setting-moments_clan_min_ca_tier`,
    section: `${S.rules} → Lately feed & luck`,
    only: 'clan',
  },
  {
    id: 'rules-feed-event-loot',
    label: 'During an event, keep hauls worth at least (gp)',
    description: 'An event’s own, lower bar for what its feed keeps.',
    keywords: ['event feed', 'hauls', 'gp floor', 'loot', 'threshold', 'moments', '1m'],
    href: `${RULES}#setting-moments_min_loot_gp`,
    section: `${S.rules} → Lately feed & luck`,
    only: 'clan',
  },
  {
    id: 'rules-luck-floor',
    label: 'Luck boards drop floor (gp)',
    description: 'Which tradeable drops count on the Luck boards. Pets and jars always count.',
    keywords: ['luck', 'lucky', 'spooned', 'gp floor', 'value', 'luck board', 'threshold'],
    href: `${RULES}#setting-luck_value_floor`,
    section: `${S.rules} → Lately feed & luck`,
    only: 'clan',
  },
  {
    id: 'rules-fee-confirmations',
    label: 'Confirmations needed to settle a fee',
    description: '0, 1 or more staff sign-offs before a paid fee counts. The collector never confirms their own.',
    keywords: ['fees', 'confirm', 'sign off', 'second signature', 'treasurer', 'settle'],
    href: `${RULES}#setting-fee_confirmations_required`,
    section: `${S.rules} → Fee sign-off`,
  },
  {
    id: 'rules-fee-autoconfirm',
    label: 'Settle collected fees when an event ends',
    description: 'Fees a staff member already marked paid settle at the end without a second sign-off.',
    keywords: ['fees', 'auto confirm', 'settle', 'event end', 'sign off'],
    href: `${RULES}#setting-fee_autoconfirm_on_event_end`,
    section: `${S.rules} → Fee sign-off`,
  },
  {
    id: 'rules-rules-link',
    label: 'Full rules link',
    description: 'Where the complete rules live, shown under the house rules in Discord.',
    keywords: ['rules link', 'url', 'google doc', 'rules'],
    href: `${RULES}#setting-board_rules_url`,
    section: `${S.rules} → House rules`,
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
    description: 'Invite the bot, re-invite it to fix permissions, or use your own bot’s token.',
    keywords: ['bot', 'invite', 'token', 'connect', 'permissions', 'server id', 'own bot', 're-invite'],
    href: `${DISCORD}#discord-connection`,
    section: 'Discord',
  },
  {
    id: 'discord-identity',
    label: 'Bot name and picture',
    description: 'How the bot appears in your server: as Anvil, as your clan, or a custom name and avatar.',
    keywords: ['bot name', 'nickname', 'avatar', 'identity', 'appearance', 'rename bot', 'bot picture'],
    href: `${DISCORD}#discord-connection`,
    section: 'Discord → Connection',
  },
  {
    id: 'discord-language',
    label: 'Bot language',
    description: 'The language the bot replies in. By default it follows each member’s own Discord language.',
    keywords: ['language', 'translate', 'locale', 'english', 'german', 'spanish', 'french', 'portuguese'],
    href: `${DISCORD}#discord-connection`,
    section: 'Discord → Connection',
  },
  {
    id: 'discord-invite-link',
    label: 'Discord invite link',
    description: 'The invite to your server shown in the top menu and on your home page.',
    keywords: ['invite link', 'join discord', 'discord url', 'server link'],
    href: `${DISCORD}#setting-discord_invite_url`,
    section: 'Discord → Connection',
    fallbackAnchor: 'discord-connection',
  },
  {
    id: 'discord-channel-layout',
    label: 'Where should posts go?',
    description: 'One channel, a few, or every kind on its own: the bot makes or links the channels for you.',
    keywords: ['quick setup', 'set it up for me', 'channel layout', 'create channels', 'redo setup', 'channels'],
    href: `${DISCORD}#discord-channel-layout`,
    section: S.quick,
    fallbackAnchor: 'discord-connection',
  },
  {
    id: 'discord-from-dink',
    label: 'Coming from Dink?',
    description: 'Anvil found other bots’ webhooks in your server: reuse the same channels for Anvil’s posts.',
    keywords: ['dink', 'old bot', 'migrate', 'switching', 'same channels', 'webhooks'],
    href: `${DISCORD}#discord-from-dink`,
    section: S.quick,
    fallbackAnchor: 'discord-quick-setup',
  },
  {
    id: 'discord-old-webhooks',
    label: 'Keep or remove old webhooks',
    description: 'Delete Dink’s and other bots’ webhooks for good, or keep the ones that still feed something else. Shows when Anvil finds any.',
    keywords: ['dink', 'webhook', 'webhooks', 'old bot', 'remove webhooks', 'keep webhooks', 'delete webhooks', 'clean up', 'put back', 'duplicate posts'],
    href: `${DISCORD}#discord-old-webhooks`,
    section: S.quick,
    fallbackAnchor: 'discord-quick-setup',
  },
  {
    id: 'discord-tell-members',
    label: 'Tell your members',
    description: 'Post a ready-made “we’re moving to Anvil” message with the setup steps in a channel.',
    keywords: ['announce', 'members', 'moving', 'switching', 'plugin setup', 'tell'],
    href: `${DISCORD}#discord-tell-members`,
    section: S.quick,
    fallbackAnchor: 'discord-connection',
  },
  {
    id: 'discord-feeds',
    label: 'What goes where',
    description: 'Every kind of post: on or off, and which channel it lands in.',
    keywords: ['channels', 'routing', 'webhooks', 'posts', 'notifications', 'feeds', 'announcements', 'catch-all'],
    href: `${DISCORD}#discord-feeds`,
    section: 'Discord',
  },
  {
    id: 'discord-game-modes',
    label: 'Game mode channels',
    description: 'Leagues, Deadman, hardcore and other modes each get their own channel and can be switched off.',
    keywords: ['leagues', 'deadman', 'dmm', 'hardcore', 'seasonal', 'worlds', 'modes', 'game mode', 'grid master', 'fresh start'],
    href: `${DISCORD}#discord-feeds-modes`,
    section: S.feeds,
  },
  {
    id: 'discord-mode-split',
    label: 'Send game-mode posts to their own channels',
    description: 'On: each mode posts to the channel picked for it. Off: every mode posts to the normal channels, labelled.',
    keywords: ['leagues channel', 'deadman channel', 'separate', 'split', 'game mode', 'own channel'],
    href: `${DISCORD}#discord-feeds-modes`,
    section: S.modes,
    only: 'clan',
  },
  {
    id: 'discord-mode-thresholds',
    label: 'Game-mode thresholds',
    description: 'Give a mode its own, stricter drop rarity (1 in N) and level milestones, and pick which kinds it posts.',
    keywords: ['threshold', 'rarity', '1/128', '1 in', 'drop floor', 'filters', 'stricter', 'leagues', 'hardcore', 'seasonal', 'deadman', 'level milestones', 'custom filters'],
    href: `${DISCORD}#discord-feeds-modes`,
    section: S.modes,
    only: 'clan',
  },
  {
    id: 'discord-drop-filters',
    label: 'Drop filters',
    description: 'How rare a drop must be to post (1 in N), items that always post, kill counts and guaranteed drops.',
    keywords: ['rarity', 'drops', 'loot', 'threshold', 'always post', 'value', 'rare', '1/128', '1 in', 'kill count', 'kc', 'guaranteed'],
    href: `${DISCORD}#discord-feed-rareDrops-filters`,
    section: `${S.feeds} → Rare drops`,
  },
  {
    id: 'discord-level-filters',
    label: 'Level milestones',
    description: 'Which level-ups, 99s, total level and XP milestones post.',
    keywords: ['levels', '99', 'xp', 'milestones', 'skills', 'maxed', 'total level', '200m'],
    href: `${DISCORD}#discord-feed-levels-filters`,
    section: `${S.feeds} → Levels & XP milestones`,
  },
  {
    id: 'discord-fun-lines',
    label: 'Death and lucky-drop lines',
    description: 'One-liners added to deaths and lucky drops. Needs Death & fun messages switched on.',
    keywords: ['fun', 'taunts', 'jokes', 'deaths', 'spoon', 'messages', 'rip', 'one-liners'],
    href: `${DISCORD}#discord-feed-deaths-filters`,
    section: `${S.feeds} → Deaths`,
    feature: 'funMessages',
  },
  {
    id: 'discord-event-posts',
    label: 'Event post defaults',
    description: 'Which event posts go out by default and who each one pings.',
    keywords: ['event posts', 'pings', 'mentions', 'defaults', 'announcements', 'daily digest', 'halfway', 'recap'],
    href: `${DISCORD}#discord-event-posts`,
    section: 'Discord',
  },
  {
    id: 'discord-player-role',
    label: 'The @Bingo player role',
    description: 'When players get the role (approval, draft or never) and whether it is taken back when an event ends.',
    keywords: ['player role', 'bingo role', 'role', 'participant role'],
    href: `${DISCORD}#discord-event-posts`,
    section: 'Discord → Event posts',
  },
  {
    id: 'discord-cleanup',
    label: 'Clean up team channels & roles',
    description: 'Never, at the end, or some days after an event ends.',
    keywords: ['cleanup', 'clean up', 'delete channels', 'archive', 'after event'],
    href: `${DISCORD}#discord-event-posts`,
    section: 'Discord → Event posts',
  },
  {
    id: 'discord-ping-role',
    label: 'Ping this role for big news',
    description: 'The role pinged when an event starts or finishes.',
    keywords: ['ping', 'mention', 'role', 'notify', 'members role', 'big news'],
    href: `${DISCORD}#discord-ping-role`,
    section: 'Discord → Roles',
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
    id: 'discord-role-sync',
    label: 'Role and nickname sync',
    description: 'Give linked members their rank and default roles, set nicknames to their RSN, and the guest roles.',
    keywords: ['role sync', 'nickname', 'nicknames', 'rsn', 'guest role', 'member role', 'sync roles'],
    href: `${DISCORD}#discord-role-sync`,
    section: 'Discord → Roles & nicknames',
    only: 'clan',
  },
  {
    id: 'discord-rank-rules',
    label: 'Rank rules',
    description: 'Give Discord roles from in-game rank, keep them after a demotion, and suggest site access.',
    keywords: ['rank', 'ranks', 'rank rules', 'in-game rank', 'promotion', 'demotion', 'ladder'],
    href: `${DISCORD}#discord-rank-rules`,
    section: 'Discord → Roles & nicknames',
    only: 'clan',
  },
  {
    id: 'discord-team-channels',
    label: 'Team channels',
    description: 'A private voice and text channel and a role for each team during an event, and the captain role.',
    keywords: ['teams', 'voice', 'private channels', 'category', 'captain role', 'team role'],
    href: `${DISCORD}#discord-team-channels`,
    section: 'Discord',
  },
  {
    id: 'discord-clan-hall',
    label: 'Clan Hall card',
    description: 'Shows who’s online in your Discord on your public clan page, and the embed and badge.',
    keywords: ['widget', 'online', 'presence', 'clan hall', 'embed', 'badge'],
    href: `${DISCORD}#discord-clan-hall`,
    section: 'Discord',
    feature: 'clanHall',
  },
  {
    id: 'discord-commands',
    label: 'Slash commands',
    description: 'Switch off any bot command your server doesn’t need: /bingo, /stats, /sotw, /coffer and the rest.',
    keywords: ['commands', 'slash', '/bingo', 'bot commands', 'disable command', 'sotw', 'botw', 'eff'],
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

  // Personal, not clan: on the person's own settings and the apex.
  {
    id: 'profile-announcements',
    label: 'Your own announcements',
    description:
      'Where your own drops, pets and deaths are announced across every clan, and your personal Discord webhooks. On your profile, and only shown once you have a character.',
    keywords: ['personal', 'my announcements', 'my webhooks', 'webhook', 'opt out', 'emissions', 'profile', 'notifications'],
    href: '/settings/announcements',
    section: 'Your account',
  },
  {
    id: 'my-boosts',
    label: 'Boost a clan',
    description: 'As a Supporter, spend your boosts on the clans you are in.',
    keywords: ['boost', 'boosts', 'my boosts', 'nitro', 'supporter', 'give boost'],
    href: '/settings/boosts',
    section: 'Your account',
  },
  {
    id: 'challenges',
    label: 'Head-to-head challenges',
    description: 'Challenge a friend one on one: first to a drop, or most kills or XP in a set time. One open challenge free.',
    keywords: ['head to head', 'h2h', '1v1', 'duel', 'challenge', 'versus', 'vs', 'friend'],
    href: '/challenges',
    section: 'Your account',
  },
  {
    id: 'friends-events',
    label: 'Friend events',
    description: 'A private board for you and your friends, hosted from no clan at all. A Supporter perk.',
    keywords: ['friends', 'friend event', 'private board', 'small group', 'supporter', 'host'],
    href: '/host/friends',
    section: 'Your account',
  },
];

/** The individual lines inside the sections above that people ask for by name. */
const DETAILS: readonly SettingEntry[] = [
  // Discord → What goes where, inside a row's filters
  {
    id: 'discord-always-post',
    label: 'Always post these items',
    description: 'Prestige items that post whatever their value, plus your own extra items.',
    keywords: ['always notify', 'prestige', 'items', 'whitelist', 'always post', 'drops'],
    href: `${DISCORD}#always-notify-items`,
    section: `${S.feeds} → Rare drops`,
    fallbackAnchor: 'discord-feed-rareDrops-filters',
  },
  {
    id: 'discord-kill-count',
    label: 'Show kill count on rare-drop posts',
    description: 'Adds the boss kill count to each drop post.',
    keywords: ['kc', 'kill count', 'drops', 'boss'],
    href: `${DISCORD}#discord-feed-rareDrops-filters`,
    section: `${S.feeds} → Rare drops`,
  },
  {
    id: 'discord-guaranteed-drops',
    label: 'Drops that are guaranteed',
    description: 'Items a source always hands over, so their posts skip the lucky-drop line.',
    keywords: ['guaranteed', 'always drops', 'lucky', 'spoon', 'drops'],
    href: `${DISCORD}#discord-feed-rareDrops-filters`,
    section: `${S.feeds} → Rare drops`,
  },
  {
    id: 'discord-drop-floor',
    label: 'Post drops rarer than 1 in…',
    description: 'The rarity floor for posting a drop on rarity alone. Blank = 1 in 10,000.',
    keywords: ['rarity', '1/128', '1 in', 'drop rate', 'threshold', 'floor', 'rare'],
    href: `${DISCORD}#setting-drop_rarity_floor`,
    section: `${S.feeds} → Rare drops`,
    fallbackAnchor: 'discord-feed-rareDrops-filters',
  },
  // Roles & nicknames, line by line
  {
    id: 'discord-nickname-overwrite',
    label: 'Overwrite existing nicknames too',
    description: 'Also replace nicknames people set themselves with their RSN.',
    keywords: ['nickname', 'rsn', 'overwrite', 'rename members'],
    href: `${DISCORD}#discord-role-sync`,
    section: 'Discord → Roles & nicknames',
    only: 'clan',
  },
  {
    id: 'discord-guest-roles',
    label: 'Guest roles',
    description: 'The Discord roles verified guests from other clans get.',
    keywords: ['guest role', 'guests', 'visitor role', 'other clans'],
    href: `${DISCORD}#discord-role-sync`,
    section: 'Discord → Roles & nicknames',
    only: 'clan',
  },
  {
    id: 'discord-rank-demotion',
    label: 'Take rule roles away when someone’s rank drops',
    description: 'Remove rank-rule roles on a demotion, unless a rule says keep it.',
    keywords: ['demotion', 'rank drop', 'remove role', 'rank rules'],
    href: `${DISCORD}#discord-rank-rules`,
    section: 'Discord → Roles & nicknames',
    only: 'clan',
  },
  // Team channels, Clan Hall
  {
    id: 'discord-cohost-team-roles',
    label: 'Team channels for events another clan hosts',
    description: 'Also hand out the player role and team channels for co-hosted events.',
    keywords: ['co-host', 'cohost', 'other clan', 'team channels', 'player role'],
    href: `${DISCORD}#discord-team-channels`,
    section: 'Discord → Team channels',
    only: 'clan',
  },
  {
    id: 'discord-captain-role',
    label: 'Team captain role',
    description: 'The Discord role each team’s captain gets.',
    keywords: ['captain', 'role', 'team captain'],
    href: `${DISCORD}#discord-team-channels`,
    section: 'Discord → Team channels',
  },
  {
    id: 'discord-clan-hall-embed',
    label: 'Clan Hall embed and badge',
    description: 'Show names to visitors, and allow the who’s-online card and badge on other sites.',
    keywords: ['embed', 'badge', 'iframe', 'widget', 'online count', 'show names'],
    href: `${DISCORD}#discord-clan-hall`,
    section: 'Discord → Clan Hall card',
    feature: 'clanHall',
  },
  // People
  {
    id: 'people-board-builder',
    label: 'Can build bingo boards',
    description: 'Let a member edit tiles on every board, or only the boards you pick, without a staff role.',
    keywords: ['board editor', 'tile editor', 'builder', 'edit tiles', 'boards', 'permission'],
    href: '/admin/people/staff',
    section: 'People → Staff & roles',
    minRole: 'admin',
  },
  {
    id: 'people-guide-writer',
    label: 'Can write guides',
    description: 'Let a member write and edit the clan’s guides without a staff role.',
    keywords: ['guide writer', 'guides', 'editor', 'permission'],
    href: '/admin/people/staff',
    section: 'People → Staff & roles',
    minRole: 'admin',
  },
  {
    id: 'people-transfer',
    label: 'Make owner',
    description: 'Hand the clan to another admin. Only the owner can do it.',
    keywords: ['transfer ownership', 'owner', 'hand over', 'leave clan'],
    href: '/admin/people/staff',
    section: 'People → Staff & roles',
    minRole: 'owner',
  },
  {
    id: 'people-ban',
    label: 'Ban someone',
    description: 'Ban or unban an account from this clan, from its row on Staff & roles.',
    keywords: ['ban', 'unban', 'kick', 'block', 'remove member'],
    href: '/admin/people/staff',
    section: 'People → Staff & roles',
    minRole: 'admin',
  },
  {
    id: 'people-claims',
    label: 'Claim requests',
    description: 'Someone says a character on your roster is theirs: confirm or turn it down.',
    keywords: ['claim', 'ownership', 'this is my account', 'character'],
    href: '/admin/people/needs-review',
    section: 'People → Needs review',
    only: 'clan',
  },
  // Guides and tasks
  {
    id: 'guides-library-on-site',
    label: 'Show library guides on our site',
    description: 'List the Anvil library’s guides on your clan’s Guides page, without copying them.',
    keywords: ['library', 'guides', 'show', 'anvil guides'],
    href: '/admin/guides',
    section: 'Clan → Guides',
  },
  {
    id: 'guides-post',
    label: 'Post guides to Discord',
    description: 'Post your published guides to a Discord channel or forum in one go.',
    keywords: ['guides', 'discord', 'forum', 'post', 'publish'],
    href: '/admin/guides',
    section: 'Clan → Guides',
  },
  {
    id: 'tile-library-suggest',
    label: 'Suggest a task to Anvil',
    description: 'Send a task to the shared Anvil library, or pull in Anvil’s starter tasks.',
    keywords: ['suggest', 'starter tasks', 'import', 'anvil library', 'share task'],
    href: '/admin/tile-library',
    section: 'Events → Task library',
  },
  // Money
  {
    id: 'fees-remind',
    label: 'Remind unpaid players',
    description: 'DM everyone on a board who still owes their entry fee.',
    keywords: ['remind', 'unpaid', 'dm', 'nudge', 'fees', 'owe'],
    href: '/admin/fees',
    section: 'Money → Fees',
    feature: 'fees',
  },
  {
    id: 'fees-close-out',
    label: 'Close out a board’s fees',
    description: 'After an event ends: settle what was collected and write off the rest.',
    keywords: ['close out', 'write off', 'settle', 'fees', 'ended'],
    href: '/admin/fees',
    section: 'Money → Fees',
    feature: 'fees',
  },
  // One event's Discord tab and Home
  {
    id: 'event-discord-presets',
    label: 'Event Discord presets',
    description: 'Open an event, then Discord: Clan defaults, Quiet, Silent, or pick post by post.',
    keywords: ['quiet', 'silent', 'presets', 'mute event', 'fewer posts', 'event posts'],
    href: '/admin/events',
    section: 'Event pages → Discord',
    needsEvent: true,
    eventPath: 'discord#event-discord-posts',
  },
  {
    id: 'event-discord-pause',
    label: 'Pause an event’s posts',
    description: 'Open an event, then Discord: stop its posts until a date, without changing anything else.',
    keywords: ['pause', 'stop posting', 'quiet', 'until', 'mute'],
    href: '/admin/events',
    section: 'Event pages → Discord',
    needsEvent: true,
    eventPath: 'discord#event-discord-posts',
  },
  {
    id: 'event-discord-fix',
    label: 'Fix what Anvil made in Discord',
    description: 'Open an event, then Discord: create missing channels and roles, re-sync roles, or delete them.',
    keywords: ['missing channels', 're-sync', 'resync roles', 'broken', 'repair', 'delete channels'],
    href: '/admin/events',
    section: 'Event pages → Discord',
    needsEvent: true,
    eventPath: 'discord#event-discord-now',
  },
  ...(
    [
      ['list-on-anvil', 'List an event on Anvil', 'Advertise one event on anvilosrs.com/events while it is upcoming or live.', 'settings/access#access', ['list on anvil', 'advertise', 'public', 'events page', 'directory']],
      ['ask-first', 'Ask me about everyone', 'Every entry waits for your yes, even from people you invited.', 'settings/access#access', ['approval', 'approve players', 'ask to join', 'who can enter']],
      ['shared-accounts', 'Check for shared accounts', 'Flag shared networks or impossible travel to staff during the event.', 'settings/rules#rulebook', ['shared account', 'boosting', 'cheating', 'ip', 'alt', 'account sharing']],
      ['point-decay', 'Points that change over time', 'Points decay (or grow) the longer a task has been open, with a floor or cap.', 'settings/board#opening', ['decay', 'grow', 'points over time', 'diminishing']],
      ['first-finisher', 'First-finisher bonus and locks', 'Extra points for the first team to finish a task, or lock it for everyone else.', 'settings/board#opening', ['first finisher', 'bonus', 'lock', 'race', 'first to']],
      ['celebrate', 'Celebrate on stream', 'A pop-up on your overlay when a tile finishes or a team scores.', 'settings/stream#overlay', ['celebrate', 'pop-up', 'alert', 'overlay', 'stream']],
    ] as const
  ).map(([slug, label, description, path, kw]): SettingEntry => ({
    id: `event-detail-${slug}`,
    label,
    description: `Open an event, then Settings: ${description.charAt(0).toLowerCase()}${description.slice(1)}`,
    keywords: ['event', 'event settings', ...kw],
    href: '/admin/events',
    section: 'Event settings',
    needsEvent: true,
    eventPath: path,
  })),
  {
    id: 'event-starting-shot',
    label: 'Starting shot',
    description: 'Open an event, then Home → Extras: every player files one screenshot after the start, at a drawn spot.',
    keywords: ['starting shot', 'start screenshot', 'stacking', 'banked', 'anti cheat', 'fresh session', 'relog'],
    href: '/admin/events',
    section: 'Event pages → Home',
    needsEvent: true,
    eventPath: '',
  },
];

/** Each slash command's own switch (Discord → Commands). */
function commandEntries(): SettingEntry[] {
  return TOGGLEABLE_COMMANDS.map((c) => ({
    id: `discord-command-${c.name}`,
    label: `${c.label} command`,
    description: `${c.help}. Switch it off if your server doesn’t need it.`,
    keywords: ['slash command', 'command', 'disable', c.name],
    href: `${DISCORD}#discord-commands`,
    section: 'Discord → Commands',
    only: 'clan' as const,
  }));
}

/** Each kind of event post: on by default or not, and who it pings (Discord → Event posts). */
function postTypeEntries(): SettingEntry[] {
  return DISCORD_POST_TYPES.map((t) => ({
    id: `discord-post-${t.key}`,
    label: `${t.label} post`,
    description: `${t.help}. Default on or off, and who it pings, for every event.`,
    keywords: ['event post', 'post', 'ping', 'announcement', POST_GROUPS.find((g) => g.key === t.group)?.label ?? ''],
    href: `${DISCORD}#discord-event-posts`,
    section: 'Discord → Event posts',
  }));
}

/** Webhook settings whose bot-routed twin is a row of "What goes where" (lib/discordFeeds). */
const FEED_BY_KEY = new Map<string, { id: string; tab: FeedTab }>(DISCORD_FEEDS.map((f) => [f.key, { id: f.id, tab: f.tab }]));
/** The two catch-alls, which head their tabs rather than a row. */
const CATCH_ALL_TAB: Record<string, FeedTab> = { discord_webhook_url: 'clan', webhook_plugin_default: 'game' };

const KIND_WORDS: Record<SettingField['kind'], readonly string[]> = {
  webhook: ['webhook', 'channel', 'discord', 'notifications', 'announcements', 'posts'],
  plain: ['discord'],
  toggle: ['discord', 'toggle'],
};

const tabLabel = (tab: FeedTab) => FEED_TABS.find((t) => t.id === tab)?.label ?? tab;

/** One entry per Discord destination, straight off lib/webhookFields so a new field is searchable at once. */
function webhookEntries(): SettingEntry[] {
  const sections: readonly WebhookSection[] = WEBHOOK_SECTIONS;
  return sections.flatMap((section) =>
    section.fields.map((field): SettingEntry => {
      // With the bot, a channel is picked on its row of What goes where; the pasted-link field is the fallback.
      const feed = FEED_BY_KEY.get(field.key);
      const catchAll = CATCH_ALL_TAB[field.key];
      const href = feed
        ? `${DISCORD}#discord-feed-${feed.id}`
        : catchAll
          ? `${DISCORD}#discord-feeds-${catchAll}`
          : `${DISCORD}#setting-${field.key}`;
      return {
        id: `webhook-${field.key}`,
        // The main channel's field is just "Channel" on its page; out of context it needs its section.
        label: field.label === 'Channel' ? section.title : field.label,
        description: field.help,
        keywords: [...KIND_WORDS[field.kind], field.key, section.title, groupLabel(section.group)],
        href,
        section: feed ? `${S.feeds} → ${tabLabel(feed.tab)}` : catchAll ? `${S.feeds} → ${tabLabel(catchAll)}` : S.byHand,
        fallbackAnchor: feed || catchAll ? 'discord-feeds' : 'discord-by-hand',
        ...(field.key === 'discord_webhook_coffer' ? { feature: 'coffer' as const } : {}),
      };
    }),
  );
}

/** One per game mode Anvil knows: its row on the Game modes tab, with its posts and filters. */
function modeEntries(): SettingEntry[] {
  return WORLD_MODES.map((m) => ({
    id: `discord-mode-${m.key}`,
    label: `${m.label} posts`,
    description: `${m.label} worlds: on or off, their own channel, which kinds post, and stricter drop and level filters.`,
    keywords: ['game mode', 'modes', 'worlds', 'threshold', 'filters', m.key.replace(/-/g, ' '), ...(m.key === 'seasonal-deadman' || m.key === 'leagues' ? ['seasonal'] : []), ...(m.key.includes('deadman') ? ['dmm'] : [])],
    href: `${DISCORD}#discord-mode-${m.key}`,
    section: S.modes,
    fallbackAnchor: 'discord-feeds-modes',
    only: 'clan' as const,
  }));
}

/** One per module switch on Clan settings → Features. */
function featureEntries(): SettingEntry[] {
  return FEATURES.map((f) => ({
    id: `feature-${f.key}`,
    label: `${f.name} on/off`,
    description: f.what,
    keywords: ['feature', 'enable', 'disable', 'switch', 'toggle', f.group],
    href: `/admin/features#feature-${f.key}`,
    section: S.features,
  }));
}

// ── One event's pages ───────────────────────────────────────────────────────────────────────────

/** The event's own tabs (lib/eventRail), and the parts of its Discord tab people ask for by name. */
const EVENT_PAGES: readonly (readonly [string, string, string, string, readonly string[]])[] = [
  ['tiles', 'tiles', 'Event tiles', 'Open an event, then Tiles: add, edit and balance the board’s tasks.', ['tasks', 'board', 'squares', 'points', 'csv', 'import']],
  ['teams', 'teams', 'Event teams & draft', 'Open an event, then Teams & draft: teams, captains, the draft and team staff.', ['captains', 'draft', 'roster', 'team channels', 'sub', 'auto-balance']],
  ['signups', 'signups', 'Event sign-ups', 'Open an event, then Sign-ups: approve players, sign-up questions and fees.', ['registration', 'join', 'applications', 'questions', 'entry fee']],
  ['stats', 'stats', 'Event stats', 'Open an event, then Stats: standings, gains and baselines.', ['standings', 'leaderboard', 'progress', 'baselines']],
  ['proofs', 'proofs', 'Event proofs', 'Open an event, then Proofs: every submission on the board, flagged or not.', ['submissions', 'screenshots', 'evidence']],
  ['prizes', 'payouts', 'Event prizes & payouts', 'Open an event, then Prizes: the pot, places and who gets paid.', ['payouts', 'prize pool', 'pot', 'rewards', 'winners']],
  ['discord', 'discord', 'Event Discord', 'Open an event, then Discord: which posts this event sends, where, and who they ping.', ['announcements', 'channel', 'webhook', 'ping', 'roles', 'presets', 'quiet', 'silent']],
  ['discord-chat', 'discord#event-chat', 'Event chat and in-game feed', 'Open an event, then Discord: players’ chat in the plugin (it slows itself when busy; mods mute and pause) and the drops feed in RuneLite chat.', ['event chat', 'slow mode', 'mute', 'pause chat', 'chat feed', 'runelite chat', 'plugin chat']],
  ['discord-server', 'discord#event-discord-server', 'Event Discord server', 'Open an event, then Discord: a shared server for a co-hosted event, and the join link for players.', ['joint server', 'co-host', 'event server', 'join link', 'invite']],
  ['discord-extra', 'discord#event-discord-extra', 'More Discord channels for an event', 'Open an event, then Discord: extra webhooks that get a copy of its posts.', ['extra webhook', 'copy posts', 'another server', 'webhook']],
  ['settings', 'settings', 'Event settings', 'Open an event, then Settings: dates, visibility, who can enter, rules, staff and more.', ['dates', 'visibility', 'co-host', 'editors', 'rules', 'rename']],
  ['survey', 'survey', 'Event survey', 'Open an event, then Survey: questions players answer once it ends.', ['feedback', 'questions', 'poll']],
];

function eventPageEntries(): SettingEntry[] {
  return EVENT_PAGES.map(([slug, path, label, description, kw]): SettingEntry => ({
    id: `event-${slug}`,
    label,
    description,
    keywords: ['event', 'bingo', ...kw],
    href: '/admin/events',
    section: 'Event pages',
    needsEvent: true,
    eventPath: path,
    ...(slug === 'survey' ? { feature: 'survey' as const } : {}),
  }));
}

/** Plain words for each event setting (lib/eventSettingsTabs SETTINGS_INDEX ids). */
const EVENT_SETTING_HELP: Record<string, string> = {
  look: 'The event’s icon and banner.',
  format: 'The board’s shape: bingo, race, ladder and the rest, and its size. Locked once it starts.',
  schedule: 'When it starts and ends, or open-ended.',
  reveal: 'Show or hide the board to members before the start, or reveal it early on a date.',
  opening: 'How tasks open: all at once, progressive, rotating, one at a time or on a timer; point decay and first-finisher bonuses.',
  standings: 'Hide the leaderboard until the end or a date.',
  worlds: 'Count progress made on Leagues, Deadman, hardcore and other game-mode worlds for this board.',
  rulebook: 'The rules post in Discord, an addendum, posting it at the start, and shared-account checks.',
  access: 'Who can see the event, listing it on Anvil, invites, and whether entries need your yes.',
  gate: 'Which viewers may join: Twitch followers or subs, YouTube members, Kick, a Discord role or boosters.',
  cohosts: 'Invite another clan to run a team, what they may do with the tiles, and who holds the cash.',
  staff: 'Give one person a job on this board only: editor or treasurer.',
  overlay: 'OBS overlay links, their look, celebrations on stream, and channel panels.',
  clone: 'Copy the settings and tiles into a new event.',
  template: 'Save the type, size and tiles as a preset for later events.',
  library: 'Share this board with every clan, or suggest your changes back to Anvil.',
  recompute: 'Re-check tile completions after a rule change.',
  delete: 'Delete the event for good. Not while it runs.',
};

/** Every setting on an event's Settings tabs, from the same index the tabs' own search reads. */
function eventSettingEntries(): SettingEntry[] {
  const kinds: { only: 'clan' | 'space'; kind: SettingsKind }[] = [
    // A clan that streams sees every tab; the description says when a tab needs Streaming.
    { only: 'clan', kind: { creator: false, streams: true } },
    { only: 'space', kind: { creator: true, streams: true } },
  ];
  const out: SettingEntry[] = [];
  for (const e of SETTINGS_INDEX) {
    if (e.elsewhere) continue; // the event's other tabs are EVENT_PAGES
    const variants = kinds
      .filter(({ kind }) => !e.only || e.only(kind))
      .map(({ only, kind }) => {
        const tab: SettingsTab = typeof e.tab === 'function' ? e.tab(kind) : e.tab;
        const info = tabsFor(kind).find((t) => t.key === tab);
        return info ? { only, tabLabel: info.label, path: `settings${info.slug ? `/${info.slug}` : ''}#${e.id}` } : null;
      })
      .filter((v): v is { only: 'clan' | 'space'; tabLabel: string; path: string } => v !== null);
    const same = variants.length === 2 && variants[0].path === variants[1].path && variants[0].tabLabel === variants[1].tabLabel;
    for (const v of same ? [{ ...variants[0], only: undefined }] : variants) {
      const needsStream = v.only === 'clan' && (e.id === 'gate' || e.id === 'overlay');
      out.push({
        id: `event-setting-${e.id}${v.only === 'space' && !same ? '-space' : ''}`,
        label: e.label,
        description: `${EVENT_SETTING_HELP[e.id] ?? ''}${needsStream ? ' Shown when the clan streams its events.' : ''}`.trim(),
        keywords: ['event', 'event settings', ...e.keywords],
        href: '/admin/events',
        section: `Event settings → ${v.tabLabel}`,
        needsEvent: true,
        eventPath: v.path,
        ...(v.only ? { only: v.only } : {}),
      });
    }
  }
  return out;
}

/** A weekly competition's settings, reached from inside one. */
const WEEKLY: readonly SettingEntry[] = [
  {
    id: 'weekly-settings',
    label: 'Competition name, dates and status',
    description: 'Open a Skill or Boss of the Week, then Settings: rename it, move its dates, or end or delete it.',
    keywords: ['sotw', 'botw', 'weekly', 'rename', 'dates', 'status', 'end early', 'delete competition'],
    href: '/admin/events',
    section: 'Competition → Settings',
    needsEvent: true,
    weekly: true,
    eventPath: 'settings#weekly-details',
    feature: 'weekly',
    only: 'clan',
  },
  {
    id: 'weekly-repeat',
    label: 'Repeat every week',
    description: 'Open a Skill or Boss of the Week, then Settings: start the next one by itself when this one ends.',
    keywords: ['sotw', 'botw', 'weekly', 'repeat', 'recurring', 'every week', 'automatic'],
    href: '/admin/events',
    section: 'Competition → Settings',
    needsEvent: true,
    weekly: true,
    eventPath: 'settings#weekly-repeat',
    feature: 'weekly',
    only: 'clan',
  },
  {
    id: 'weekly-prizes',
    label: 'Competition prizes',
    description: 'Open a Skill or Boss of the Week: what each place pays out of the coffer.',
    keywords: ['sotw', 'botw', 'weekly', 'prizes', 'payout', 'coffer', 'gp'],
    href: '/admin/events',
    section: 'Competition',
    needsEvent: true,
    weekly: true,
    eventPath: '#prizes',
    feature: 'weekly',
    only: 'clan',
  },
];

// ── The guides ─────────────────────────────────────────────────────────────────────────────────

/**
 * Guide sections worth finding from the admin search, by their English titles. `dict`/`key` name
 * the section in app/guide/_i18n/en.ts and `anchor` its <Section id> on the page; the test reads
 * both, so a renamed or moved section fails here instead of linking nowhere.
 */
export interface GuideSectionRef {
  readonly guide: string;
  readonly guideTitle: string;
  readonly dict: string;
  readonly key: string;
  readonly anchor: string;
  readonly title: string;
  readonly keywords: readonly string[];
  readonly only?: 'clan' | 'space';
}

export const GUIDE_SECTIONS: readonly GuideSectionRef[] = [
  { guide: 'admin', guideTitle: 'Running your first event', dict: 'admin', key: 'access', anchor: 'access', title: 'Who can do what', keywords: ['roles', 'staff', 'permissions'] },
  { guide: 'admin', guideTitle: 'Running your first event', dict: 'admin', key: 'channels', anchor: 'channels', title: 'Split posts across channels', keywords: ['channels', 'webhooks', 'discord'] },
  { guide: 'admin', guideTitle: 'Running your first event', dict: 'admin', key: 'board', anchor: 'board', title: 'Create your first board', keywords: ['new event', 'format', 'bingo'] },
  { guide: 'admin', guideTitle: 'Running your first event', dict: 'admin', key: 'teams', anchor: 'teams', title: 'Teams and the draft', keywords: ['teams', 'draft', 'captains'] },
  { guide: 'admin', guideTitle: 'Running your first event', dict: 'admin', key: 'launch', anchor: 'launch', title: 'Launch and run it', keywords: ['launch', 'start', 'reveal'] },
  { guide: 'admin', guideTitle: 'Running your first event', dict: 'admin', key: 'after', anchor: 'after', title: 'After the last tile', keywords: ['end', 'recap', 'payouts', 'survey'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'connect', anchor: 'connect', title: 'Connecting it', keywords: ['bot', 'invite', 'connect'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'channels', anchor: 'channels', title: 'Set up webhooks', keywords: ['webhooks', 'channels', 'what goes where', 'game modes'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'modes', anchor: 'modes', title: 'Leagues, Deadman and other modes', keywords: ['game modes', 'leagues', 'deadman', 'hardcore', 'seasonal', 'threshold', 'rarity'], only: 'clan' },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'cleanup', anchor: 'cleanup', title: 'Old webhooks from Dink or other bots', keywords: ['dink', 'old webhooks', 'remove webhooks', 'keep webhooks'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'roles', anchor: 'roles', title: 'Roles and nicknames', keywords: ['role sync', 'nicknames', 'rank rules'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'announce', anchor: 'announce', title: 'Post to Discord', keywords: ['announce', 'announcement', 'embed', 'ping'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'commands', anchor: 'commands', title: 'Slash commands', keywords: ['commands', 'slash'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'posts', anchor: 'posts', title: 'What it posts, and when', keywords: ['posts', 'pings', 'event posts'] },
  { guide: 'discord', guideTitle: 'Anvil in Discord', dict: 'discord', key: 'quiet', anchor: 'quiet', title: 'When it goes quiet', keywords: ['not posting', 'silent', 'broken', 'missing posts'] },
  { guide: 'moderator', guideTitle: 'On the rota', dict: 'moderator', key: 'submissions', anchor: 'submissions', title: 'Submissions and proof', keywords: ['proofs', 'submissions', 'flagged'] },
  { guide: 'moderator', guideTitle: 'On the rota', dict: 'moderator', key: 'verify', anchor: 'verify', title: 'Verifying accounts', keywords: ['verify', 'needs review', 'approve'], only: 'clan' },
  { guide: 'moderator', guideTitle: 'On the rota', dict: 'moderator', key: 'roster', anchor: 'roster', title: 'Keeping the roster true', keywords: ['roster', 'sync', 'members'], only: 'clan' },
  { guide: 'fees', guideTitle: 'Fees and payouts', dict: 'fees', key: 'set', anchor: 'set', title: 'Setting the fee', keywords: ['entry fee', 'fees'] },
  { guide: 'fees', guideTitle: 'Fees and payouts', dict: 'fees', key: 'sign', anchor: 'sign', title: 'The second signature', keywords: ['sign off', 'confirm', 'treasurer'] },
  { guide: 'fees', guideTitle: 'Fees and payouts', dict: 'fees', key: 'pay', anchor: 'pay', title: 'Paying out', keywords: ['payouts', 'prizes'] },
  { guide: 'coffer', guideTitle: 'The clan coffer', dict: 'coffer', key: 'inbound', anchor: 'in', title: 'Getting gp in', keywords: ['donations', 'coffer'], only: 'clan' },
  { guide: 'coffer', guideTitle: 'The clan coffer', dict: 'coffer', key: 'out', anchor: 'out', title: 'The three ways it pays out', keywords: ['prizes', 'coffer', 'payout'], only: 'clan' },
  { guide: 'clan', guideTitle: 'Start a clan', dict: 'clan', key: 'members', anchor: 'members', title: 'Getting your members in', keywords: ['members', 'roster', 'plugin'], only: 'clan' },
  { guide: 'clan', guideTitle: 'Start a clan', dict: 'clan', key: 'setup', anchor: 'setup', title: 'The setup wizard', keywords: ['setup', 'wizard'], only: 'clan' },
  { guide: 'clan', guideTitle: 'Start a clan', dict: 'clan', key: 'boosts', anchor: 'boosts', title: 'Clan boosts', keywords: ['boost', 'boosts', 'level', 'nitro', 'recruiting line', 'recruitment post'], only: 'clan' },
  { guide: 'commands', guideTitle: 'Slash commands', dict: 'commands', key: 'who', anchor: 'who', title: 'Who can use what', keywords: ['commands', 'permissions'] },
  { guide: 'switching', guideTitle: 'Switching from Dink or Wise Old Man', dict: 'switching', key: 'staff', anchor: 'staff', title: 'If you run the clan', keywords: ['dink', 'wom', 'wise old man', 'migrate', 'old webhooks'] },
  { guide: 'streaming-for-clans', guideTitle: 'Streaming for clans', dict: 'streamingClans', key: 'on', anchor: 'on', title: 'Turn on Streaming', keywords: ['stream', 'streaming', 'twitch'], only: 'clan' },
  { guide: 'streaming-for-clans', guideTitle: 'Streaming for clans', dict: 'streamingClans', key: 'tools', anchor: 'tools', title: 'Your stream tools', keywords: ['overlay', 'obs', 'join'], only: 'clan' },
  { guide: 'creators', guideTitle: 'Hosting events for your viewers', dict: 'creators', key: 'who', anchor: 'who', title: 'Choose who can join', keywords: ['followers', 'subs', 'gate'], only: 'space' },
  { guide: 'creators', guideTitle: 'Hosting events for your viewers', dict: 'creators', key: 'overlay', anchor: 'overlay', title: 'Put the board on stream (OBS)', keywords: ['overlay', 'obs'], only: 'space' },
  { guide: 'creators', guideTitle: 'Hosting events for your viewers', dict: 'creators', key: 'chatjoin', anchor: 'chatjoin', title: '!join in your chat', keywords: ['join', 'chat bot'], only: 'space' },
  { guide: 'creators', guideTitle: 'Hosting events for your viewers', dict: 'creators', key: 'page', anchor: 'page', title: 'Make your page yours', keywords: ['bio', 'panels', 'banner'], only: 'space' },
];

function guideEntries(): SettingEntry[] {
  return GUIDE_SECTIONS.map((g) => ({
    id: `guide-${g.guide}-${g.anchor}`,
    label: g.title,
    description: `From the guide “${g.guideTitle}”.`,
    keywords: [...g.keywords],
    href: `/guide/${g.guide}#${g.anchor}`,
    section: `Guide → ${g.guideTitle}`,
    guide: true,
    ...(g.only ? { only: g.only } : {}),
  }));
}

export const ADMIN_SETTINGS: readonly SettingEntry[] = [
  ...PAGES,
  ...DETAILS,
  ...featureEntries(),
  ...commandEntries(),
  ...postTypeEntries(),
  ...webhookEntries(),
  ...modeEntries(),
  ...eventPageEntries(),
  ...eventSettingEntries(),
  ...WEEKLY,
];

/** Guide sections, searched alongside the settings and listed below them. */
export const GUIDE_ENTRIES: readonly SettingEntry[] = guideEntries();

// ── What to show before anything is typed ───────────────────────────────────────────────────────

/**
 * Shipped lately, so an admin who never reads the changelog still trips over them. Newest first;
 * prune as they stop being news. Ids the viewer cannot see are dropped, not replaced.
 */
export const NEW_SETTING_IDS: readonly string[] = [
  'boosts',
  'discord-old-webhooks',
  'discord-mode-thresholds',
  'rules-feed-deaths',
  'announce',
  'event-discord-chat',
  'space-page-panels',
  'challenges',
];

/** What admins come for most often. */
export const POPULAR_SETTING_IDS: readonly string[] = [
  'discord-feeds',
  'people-staff',
  'discord-roles',
  'rules-house',
  'features',
  'plan',
  'discord-drop-filters',
  'space-settings',
];

/** The New and Popular lists for one viewer, each capped, Popular never repeating New. */
export function startingPoints(entries: readonly SettingEntry[], max = 6): { fresh: SettingEntry[]; popular: SettingEntry[] } {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const pick = (ids: readonly string[], skip: ReadonlySet<string>) =>
    ids.filter((id) => !skip.has(id)).map((id) => byId.get(id)).filter((e): e is SettingEntry => !!e).slice(0, max);
  const fresh = pick(NEW_SETTING_IDS, new Set());
  const popular = pick(POPULAR_SETTING_IDS, new Set(fresh.map((e) => e.id)));
  return { fresh, popular };
}

// ── Who sees what ───────────────────────────────────────────────────────────────────────────────

export interface SettingsViewer {
  /** Whether the admin gate lets this viewer open a path — built from lib/adminAccess `redirectFor`. */
  canReach(path: string): boolean;
  hasRole(min: SettingRole): boolean;
  featureOn(key: FeatureKey): boolean;
  /** Entries this kind of space does not show on its pages at all (a creator space: lib/creatorSpaces). */
  hides?(id: string): boolean;
  /** A creator space rather than an in-game clan (entries marked `only`). */
  space?: boolean;
}

/** The path part of an href: no #anchor, no ?query. */
export function pathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

export function canSeeSetting(entry: SettingEntry, viewer: SettingsViewer): boolean {
  if (entry.only === 'clan' && viewer.space) return false;
  if (entry.only === 'space' && !viewer.space) return false;
  if (entry.minRole && !viewer.hasRole(entry.minRole)) return false;
  if (entry.feature && !viewer.featureOn(entry.feature)) return false;
  if (viewer.hides?.(entry.id)) return false;
  // Only admin paths are gated by the admin table; /settings, /challenges and the guides are everyone's.
  const path = pathOf(entry.href);
  return !path.startsWith('/admin') || viewer.canReach(path);
}

export function visibleSettings(viewer: SettingsViewer, entries: readonly SettingEntry[] = ADMIN_SETTINGS): SettingEntry[] {
  return entries.filter((e) => canSeeSetting(e, viewer));
}

/**
 * Where a result goes from where the search was opened. An event's setting goes to THAT event when
 * the admin is inside one (a weekly's to that competition); anywhere else, to the events list.
 */
export function resolveHref(entry: SettingEntry, here: string): string {
  if (!entry.needsEvent || entry.eventPath === undefined) return entry.href;
  const m = entry.weekly ? /^\/admin\/events\/weekly\/(\d+)(?:\/|$)/.exec(here) : /^\/admin\/events\/(\d+)(?:\/|$)/.exec(here);
  if (!m) return entry.href;
  const base = entry.weekly ? `/admin/events/weekly/${m[1]}` : `/admin/events/${m[1]}`;
  if (!entry.eventPath) return base;
  return entry.eventPath.startsWith('#') ? `${base}${entry.eventPath}` : `${base}/${entry.eventPath}`;
}

// ── Matching ────────────────────────────────────────────────────────────────────────────────────

/** Lowercase, accents off ("Déaths" is "deaths"), split on anything that isn't a letter or digit. */
export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** "webhooks" should find "webhook", "deaths" "death": drop one trailing s from longer words. */
function stem(term: string): string {
  return term.length > 3 && term.endsWith('s') && !term.endsWith('ss') ? term.slice(0, -1) : term;
}

/** Words that say nothing about WHICH setting: "where do I change the deaths" is a search for deaths. */
const FILLER = new Set([
  'the', 'a', 'an', 'to', 'of', 'my', 'our', 'how', 'do', 'does', 'i', 'where', 'is', 'are', 'can', 'what',
  'for', 'and', 'or', 'with', 'from', 'change', 'edit', 'find', 'setting', 'settings', 'turn', 'on', 'off',
  'make', 'get', 'set', 'up',
]);

/** The words of a query that matter: filler dropped, unless that leaves nothing. */
export function queryTerms(query: string): string[] {
  const all = tokens(query).map(stem);
  const kept = all.filter((t) => !FILLER.has(t));
  return kept.length ? kept : all;
}

/**
 * Edit distance with adjacent swaps counted once ("boots" → "boost"), stopped early past `max`:
 * past that it is a different word, not a typo.
 */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, rows[i - 2][j - 2] + 1);
      row[j] = v;
      best = Math.min(best, v);
    }
    if (best > max) return false;
    rows.push(row);
  }
  return rows[a.length][b.length] <= max;
}

/** Typos are forgiven only in words long enough that one slip still leaves the word recognisable. */
const TYPO_MIN = 4;

/** Is `t` a one-slip typo of `w`, or of the start of `w` (a long word half typed, with a slip)? */
function typoOf(t: string, w: string): boolean {
  if (t.length < TYPO_MIN) return false;
  if (withinEdits(t, w, 1)) return true;
  for (const n of [t.length - 1, t.length, t.length + 1]) {
    if (n >= TYPO_MIN && n < w.length && withinEdits(t, w.slice(0, n), 1)) return true;
  }
  return false;
}

interface Haystack {
  label: string[];
  keywords: string[];
  phrases: string[];
  rest: string[];
  labelText: string;
}

const HAY = new WeakMap<SettingEntry, Haystack>();

function haystack(entry: SettingEntry): Haystack {
  let h = HAY.get(entry);
  if (!h) {
    const label = tokens(entry.label).map(stem);
    h = {
      label,
      keywords: tokens(entry.keywords.join(' ')).map(stem),
      phrases: entry.keywords.map((k) => tokens(k).map(stem).join(' ')),
      rest: tokens(`${entry.description} ${entry.section}`).map(stem),
      labelText: label.join(' '),
    };
    HAY.set(entry, h);
  }
  return h;
}

// Where a word hit, best first. The label names the setting; keywords are what people call it; the
// description and breadcrumb only mention it. A typo anywhere is worth less than a clean hit there.
const W = {
  labelFirst: 40,
  labelExact: 34,
  labelPrefix: 30,
  keywordExact: 24,
  keywordPrefix: 20,
  restExact: 12,
  restPrefix: 10,
  labelTypo: 14,
  keywordTypo: 9,
  restTypo: 4,
  wholeLabelPrefix: 50,
  wholeKeyword: 25,
  keywordPhrasePrefix: 15,
} as const;

function termScore(t: string, h: Haystack): { score: number; typo: boolean } | null {
  if (h.label[0]?.startsWith(t)) return { score: W.labelFirst, typo: false };
  if (h.label.includes(t)) return { score: W.labelExact, typo: false };
  if (h.label.some((w) => w.startsWith(t))) return { score: W.labelPrefix, typo: false };
  if (h.keywords.includes(t)) return { score: W.keywordExact, typo: false };
  if (h.keywords.some((w) => w.startsWith(t))) return { score: W.keywordPrefix, typo: false };
  if (h.rest.includes(t)) return { score: W.restExact, typo: false };
  if (h.rest.some((w) => w.startsWith(t))) return { score: W.restPrefix, typo: false };
  if (h.label.some((w) => typoOf(t, w))) return { score: W.labelTypo, typo: true };
  if (h.keywords.some((w) => typoOf(t, w))) return { score: W.keywordTypo, typo: true };
  if (h.rest.some((w) => typoOf(t, w))) return { score: W.restTypo, typo: true };
  return null;
}

/** How one entry answers a query: 0 = not at all; `typo` = only by forgiving a slip somewhere. */
export function matchSetting(entry: SettingEntry, query: string): { score: number; typo: boolean } {
  const terms = queryTerms(query);
  if (terms.length === 0) return { score: 0, typo: false };
  const h = haystack(entry);
  let score = 0;
  let typo = false;
  for (const t of terms) {
    const hit = termScore(t, h);
    if (!hit) return { score: 0, typo: false };
    score += hit.score;
    typo ||= hit.typo;
  }
  const phrase = terms.join(' ');
  if (h.labelText.startsWith(phrase)) score += W.wholeLabelPrefix;
  // A keyword PHRASE typed whole ("keep deaths", "old bot"). One word is already scored above.
  if (terms.length > 1) {
    if (h.phrases.includes(phrase)) score += W.wholeKeyword;
    else if (h.phrases.some((p) => p.startsWith(phrase))) score += W.keywordPhrasePrefix;
  }
  return { score, typo };
}

/**
 * How well one entry answers the query, or 0 when it does not. EVERY word has to hit somewhere, so
 * more words narrow; each word scores by the best place it hit (label start > label word > keyword >
 * description), so an entry NAMED by the query outranks one that merely mentions it.
 */
export function scoreSetting(entry: SettingEntry, query: string): number {
  return matchSetting(entry, query).score;
}

/**
 * Entries matching every word of the query, best first; ties keep catalogue order. Empty query →
 * none. Typo-forgiven matches are a fallback: if anything matched cleanly, they are left out, so
 * "rank" finds ranks without a "bank" tagging along.
 */
export function searchSettings(
  query: string,
  entries: readonly SettingEntry[] = ADMIN_SETTINGS,
  limit = 20,
): SettingEntry[] {
  const scored = entries
    .map((entry, i) => ({ entry, i, ...matchSetting(entry, query) }))
    .filter((r) => r.score > 0);
  const clean = scored.some((r) => !r.typo);
  return scored
    .filter((r) => !clean || !r.typo)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .slice(0, limit)
    .map((r) => r.entry);
}
