// Every member setting on /settings, as data, so "where do I change X?" has one answer.
//
// The owner's words: settings felt "quite obfuscated". The controls were all on /settings, but under
// labels that named their history rather than what they do ("Announcements" held screenshot privacy;
// "Privacy" and "Screenshot privacy" were two different pages). This catalogue feeds the hub at the
// top of /settings: the cards say in plain words what each area controls, and the search box finds a
// single setting by the words people actually type ("pms", "rare drop value", "name colour").
//
// PURE, and relative imports only: the hub's client component and a node:test suite both read it.
// THE RULE FOR ADDING TO IT: `href` is a /settings page that exists, and its #anchor is an id that
// page renders (tests/member-settings-index checks both).
//
// `/settings/characters/main` is a stand-in for "your main character's page" (that path redirects
// there); the hub swaps in the real page with `resolveMemberHref` so the #anchor survives the trip.

import { searchSettings, type MatchEntry } from './settingsMatch.ts';

export interface MemberSettingEntry extends MatchEntry {
  /** Stable and unique — the React key and the test handle. */
  readonly id: string;
  /** A /settings path, optionally with a #anchor on that page. */
  readonly href: string;
  /** Tried when `href`'s anchor never renders (a group that only shows sometimes). */
  readonly fallbackAnchor?: string;
}

/** One card in the hub: an area of settings, said plainly, with where it lives. */
export interface MemberSettingsCard {
  readonly id: string;
  readonly title: string;
  /** One sentence: what this controls. */
  readonly blurb: string;
  readonly href: string;
  /** A small glyph, matching the settings rail's. */
  readonly icon: string;
}

const POSTS = '/settings/posts';
const POSTS_SECTION = 'Posts & alerts';

export const MEMBER_SETTINGS_CARDS: readonly MemberSettingsCard[] = [
  {
    id: 'profile',
    title: 'Profile & look',
    blurb: 'Your Supporter plan and clan boosts, avatar and banner, display case, name colours and chat colours, with a live preview. Try any look before you subscribe.',
    href: '/settings/profile#plan',
    icon: '▣',
  },
  {
    id: 'characters',
    title: 'Characters',
    blurb: 'Your characters and their clans, adding one, and claims that a character is someone else’s.',
    href: '/settings/characters#your-characters',
    icon: '♟',
  },
  {
    id: 'in-game',
    title: 'In game',
    blurb: 'The plugin’s sign-in token, the chat feed and login brief in your chatbox, and event chat per board.',
    href: '/settings/in-game#plugin',
    icon: '⚿',
  },
  {
    id: 'posts',
    title: 'Posts & alerts',
    blurb: 'How Anvil notifies you, what your plugin posts to your clans’ Discords, screenshot privacy, and your own webhooks.',
    href: '/settings/posts#discord-posts',
    icon: '📣',
  },
  {
    id: 'account',
    title: 'Account',
    blurb: 'Login, devices and sessions, clan billing, your streaming accounts, and who sees your characters.',
    href: '/settings/account#login',
    icon: '⏻',
  },
];

export const MEMBER_SETTINGS: readonly MemberSettingEntry[] = [
  // ── Discord posts & screenshots ───────────────────────────────────────────────────────────────
  {
    id: 'posts-drops',
    label: 'Rare drop posts',
    description: 'Post valuable or very rare drops, with a minimum gp value, a 1-in-N rarity and a loot key value; they follow the clan default until you set your own.',
    keywords: ['drops', 'rare drop value', 'min drop value', 'rarity', 'default', 'clan default', 'reset', 'both', 'and', 'drop rarity', 'loot key', 'gp', 'loot', 'notify', 'notifications', 'announcements'],
    href: `${POSTS}#posts-drops`,
    section: POSTS_SECTION,
  },
  {
    id: 'posts-pets',
    label: 'Pet posts',
    description: 'Post to the clan drops channel when you get a pet.',
    keywords: ['pets', 'pet', 'notify', 'announcements'],
    href: `${POSTS}#posts-drops`,
    section: POSTS_SECTION,
  },
  {
    id: 'posts-deaths',
    label: 'Death posts and death message',
    description: 'Post a screenshot when you die, with your own message ({name} is your RSN).',
    keywords: ['deaths', 'death', 'death message', 'died', 'rip', 'notify', 'announcements'],
    href: `${POSTS}#posts-deaths`,
    section: POSTS_SECTION,
  },
  {
    id: 'posts-pvp',
    label: 'PvP kill posts',
    description: 'Post a screenshot to the clan PvP channel when you kill a player.',
    keywords: ['pvp', 'pk', 'player kill', 'kills', 'wilderness', 'notify'],
    href: `${POSTS}#posts-deaths`,
    section: POSTS_SECTION,
  },
  {
    id: 'posts-achievements',
    label: 'Achievement posts',
    description: 'Collection log slots, level milestones, diary completions, and the combat task and quest tiers that post.',
    keywords: [
      'combat achievements', 'combat tasks', 'ca', 'ca tier', 'quests', 'quest tier', 'levels', 'level milestones', '99',
      'diaries', 'achievement diary', 'clog', 'collection log', 'notify', 'announcements',
    ],
    href: `${POSTS}#posts-achievements`,
    section: POSTS_SECTION,
  },
  {
    id: 'screenshot-privacy',
    label: 'Screenshot privacy',
    description: 'Hide private messages, public chat, clan chat, friends chat or group chat in every screenshot the plugin takes.',
    keywords: [
      'screenshot', 'screenshots', 'private messages', 'pms', 'pm', 'hide chat', 'clan chat', 'public chat', 'chat channel',
      'friends chat', 'group chat', 'privacy', 'blur', 'censor',
    ],
    href: `${POSTS}#screenshot-privacy`,
    section: POSTS_SECTION,
  },
  {
    id: 'posts-guest-clans',
    label: 'Keep posts out of clans I guest in',
    description: 'Stop your drops and deaths posting in clans you only guest in, and turn your level posts down.',
    keywords: ['guest', 'guest clans', 'other clans', 'level posts', 'opt out', 'which clans', 'announcements'],
    href: `${POSTS}#where-posts-go`,
    section: POSTS_SECTION,
  },
  {
    id: 'webhooks',
    label: 'Your own Discord webhooks',
    description: 'Send copies of your posts to your own Discord channels, with their own level rules.',
    keywords: ['webhook', 'webhooks', 'my discord', 'personal', 'own channel', 'level rules'],
    href: '/settings/posts#your-webhooks',
    section: 'Posts & alerts',
  },

  // ── Plugin, login and chat ────────────────────────────────────────────────────────────────────
  {
    id: 'plugin-token',
    label: 'Plugin token',
    description: 'The token the Anvil RuneLite plugin signs in with. Sign in with Discord in the panel sets it for you.',
    keywords: ['token', 'plugin token', 'account token', 'runelite', 'api key', 'paste token', 'rotate', 'plugin connection'],
    href: '/settings/in-game#plugin-token',
    section: 'In game',
  },
  {
    id: 'plugin-sign-ins',
    label: 'Computers signed in',
    description: 'Each RuneLite that signed in with Discord; revoke one, or link another computer with a code.',
    keywords: ['devices', 'computers', 'revoke', 'sign in', 'link device', 'code', 'runelite', 'plugin connection'],
    href: '/settings/account#plugin-sign-ins',
    section: 'Account',
  },
  {
    id: 'sign-out',
    label: 'Sign out everywhere',
    description: 'End every session on the site and in the plugin.',
    keywords: ['sign out', 'log out', 'logout', 'sessions', 'security', 'hacked'],
    href: '/settings/account#sessions',
    section: 'Account',
  },
  {
    id: 'chat-feed',
    label: 'In-game chat feed',
    description: 'Other players’ drops and achievements in your RuneLite chatbox, where from, and its colours.',
    keywords: ['chat feed', 'feed', 'chatbox', 'in game chat', 'game chat', 'colours', 'colors', 'runelite'],
    href: '/settings/in-game#chat-feed',
    section: 'In game',
  },
  {
    id: 'chat-colours',
    label: 'Chat colours and the [Anvil] tag',
    description: 'The colours of Anvil’s lines in your chatbox, and the [Anvil] tag’s colour (free for everyone).',
    keywords: ['chat colours', 'chat colors', 'tag colour', 'anvil tag', 'line colours', 'palette'],
    href: '/settings/profile#chat-colours',
    section: 'Profile & look',
  },
  {
    id: 'event-chat',
    label: 'Event chat in the chatbox',
    description: 'Whether each board’s event chat also prints in your game chatbox.',
    keywords: ['event chat', 'board chat', 'chatbox', 'mute board'],
    href: '/settings/in-game#event-chat',
    section: 'In game',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'A sound for new notices on the site, and important updates by Discord DM.',
    keywords: ['notifications', 'notices', 'sound', 'chime', 'dm', 'direct message', 'inbox', 'alerts'],
    href: '/settings/posts#notifications',
    section: 'Posts & alerts',
  },
  {
    id: 'login-brief',
    label: 'Login brief',
    description: 'The short brief in chat when you log in.',
    keywords: ['login', 'log in', 'brief', 'welcome message', 'summary'],
    href: '/settings/in-game#chat-feed',
    section: 'In game',
  },

  // ── Characters and privacy ────────────────────────────────────────────────────────────────────
  {
    id: 'add-character',
    label: 'Add a character',
    description: 'Link a character by name, or accept one the plugin saw you play.',
    keywords: ['add account', 'link account', 'new character', 'alt', 'rsn', 'accounts', 'characters', 'detected'],
    href: '/settings/characters#link-account',
    section: 'Characters',
  },
  {
    id: 'character-clans',
    label: 'A character’s clans',
    description: 'Which clans each character posts in, and leaving one.',
    keywords: ['clans', 'leave clan', 'home clan', 'guest', 'accounts', 'characters'],
    href: '/settings/characters/main#clans',
    section: 'Characters',
  },
  {
    id: 'main-character',
    label: 'Main character, rename or remove',
    description: 'Make a character your main, ask for a name change, or unlink it.',
    keywords: ['main', 'primary', 'rename', 'name change', 'remove', 'unlink', 'delete account', 'accounts', 'characters'],
    href: '/settings/characters/main#character',
    section: 'Characters',
  },
  {
    id: 'character-visibility',
    label: 'Who sees each character',
    description: 'Give a character a public page and a place on cross-clan leaderboards, or keep it to its clans.',
    keywords: ['public', 'private', 'hide', 'share', 'leaderboards', 'visibility', 'privacy', 'accounts', 'characters'],
    href: '/settings/account#character-visibility',
    section: 'Account',
  },
  {
    id: 'link-characters',
    label: 'Show my characters are one person',
    description: 'Link your public characters to each other, and choose whether other clans’ boards show on your home.',
    keywords: ['link accounts', 'alts', 'same person', 'discover', 'public boards', 'privacy'],
    href: '/settings/account#across-anvil',
    section: 'Account',
  },
  {
    id: 'claims',
    label: 'Ownership claims',
    description: 'Answer someone who says a character of yours is theirs, or follow your own claim.',
    keywords: ['claim', 'this is my account', 'stolen', 'not mine', 'dispute', 'ownership'],
    href: '/settings/characters#claims-on-yours',
    section: 'Characters',
  },

  // ── Supporter and looks ───────────────────────────────────────────────────────────────────────
  {
    id: 'name-colours',
    label: 'Name colours',
    description: 'The colour and style your name wears on boards, rosters, Discord posts and other players’ game chat.',
    keywords: ['name colour', 'name color', 'colours', 'colors', 'flair', 'gradient', 'supporter', 'style'],
    href: '/settings/profile#name-colours',
    section: 'Profile & look',
  },
  {
    id: 'supporter',
    label: 'Supporter membership',
    description: 'Your tier, what each perk needs, billing and your invite link.',
    keywords: ['supporter', 'champion', 'patron', 'membership', 'subscription', 'perks', 'billing', 'invite', 'referral', 'gumroad'],
    href: '/settings/profile#perks',
    section: 'Profile & look',
  },
  {
    id: 'boosts',
    label: 'Clan boosts',
    description: 'As a Champion or Patron, put your boosts on clans you are in.',
    keywords: ['boost', 'boosts', 'boost clan', 'nitro'],
    href: '/settings/profile#boosts',
    section: 'Profile & look',
  },
  {
    id: 'avatar-banner',
    label: 'Avatar and banner',
    description: 'Your own picture and banner, animated, on your profile and plugin card.',
    keywords: ['avatar', 'banner', 'picture', 'gif', 'profile look', 'image'],
    href: '/settings/profile#avatar-banner',
    section: 'Profile look',
  },
  {
    id: 'display-case',
    label: 'Display case',
    description: 'Pin your best drops, kill counts and times to your profile.',
    keywords: ['display case', 'pins', 'showcase', 'best drops', 'profile look'],
    href: '/settings/profile#display-case',
    section: 'Profile look',
  },
  {
    id: 'connections',
    label: 'Streaming accounts',
    description: 'Link Twitch, YouTube, Kick or Medal.',
    keywords: ['twitch', 'youtube', 'kick', 'medal', 'stream', 'streamer', 'connected accounts'],
    href: '/settings/account#streaming',
    section: 'Account',
  },
];

/** The path part of an href: no #anchor, no ?query. */
export function memberPathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

/**
 * `/settings/characters/main…` is "your main character's page": point it at that character, keeping
 * the #anchor, or at Add a character when there is none yet. (The address works on its own too: the
 * character page redirects `main` to the main character.)
 */
export function resolveMemberHref(href: string, mainAccountId: number | null): string {
  if (memberPathOf(href) !== '/settings/characters/main') return href;
  if (mainAccountId == null) return '/settings/characters#link-account';
  const at = href.indexOf('#');
  return `/settings/characters/${mainAccountId}${at >= 0 ? href.slice(at) : ''}`;
}

/** Settings matching every word of the query, best first. */
export function searchMemberSettings(query: string, limit = 8): MemberSettingEntry[] {
  return searchSettings(query, MEMBER_SETTINGS, limit);
}
