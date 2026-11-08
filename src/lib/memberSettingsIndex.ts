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
// `/settings/characters` is a stand-in for "your main character's page" (that path redirects there);
// the hub swaps in the real page with `resolveMemberHref` so the #anchor survives the trip.

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

const POSTS = '/settings/announcements';
const POSTS_SECTION = 'Discord posts & screenshots';

export const MEMBER_SETTINGS_CARDS: readonly MemberSettingsCard[] = [
  {
    id: 'discord-posts',
    title: 'Discord posts',
    blurb: 'Which of your drops, pets, deaths, levels and achievements your plugin posts to your clans’ Discords.',
    href: `${POSTS}#plugin-posts`,
    icon: '📣',
  },
  {
    id: 'screenshot-privacy',
    title: 'Screenshot privacy',
    blurb: 'Which chat (private messages, public, clan) is hidden in every screenshot the plugin takes.',
    href: `${POSTS}#screenshot-privacy`,
    icon: '◑',
  },
  {
    id: 'characters',
    title: 'Your characters',
    blurb: 'Link a character, pick your main, choose its clans, or remove one.',
    href: '/settings/characters#clans',
    icon: '♟',
  },
  {
    id: 'plugin',
    title: 'Plugin connection',
    blurb: 'The token the RuneLite plugin signs in with. Signed-in computers are under Login & devices.',
    href: '/settings/plugin#plugin-token',
    icon: '⚿',
  },
  {
    id: 'chat-feed',
    title: 'In-game chat feed',
    blurb: 'What the plugin shows in your chatbox: other players’ drops and your login brief.',
    href: '/settings/chat#chat-feed',
    icon: '💬',
  },
  {
    id: 'supporter',
    title: 'Name colours & Supporter',
    blurb: 'Your Supporter tier, the colour your name wears on boards, Discord and game chat, and its perks.',
    href: '/settings/supporter#name-colours',
    icon: '★',
  },
  {
    id: 'privacy',
    title: 'Who sees your characters',
    blurb: 'Whether each character has a public page and shows on cross-clan leaderboards.',
    href: '/settings/privacy#character-visibility',
    icon: '◐',
  },
  {
    id: 'webhooks',
    title: 'Your own Discord webhooks',
    blurb: 'Copies of your posts sent to your own Discord channel, separate from any clan.',
    href: '/settings/webhooks#your-webhooks',
    icon: '⌁',
  },
  {
    id: 'look',
    title: 'Profile look',
    blurb: 'Your avatar, banner and display case of best drops on your public profile.',
    href: '/settings/look#avatar-banner',
    icon: '▣',
  },
  {
    id: 'connections',
    title: 'Streaming accounts',
    blurb: 'Link Twitch, YouTube, Kick or Medal for streamers’ follower events and your profile.',
    href: '/settings/connections',
    icon: '⇄',
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
    href: '/settings/webhooks#your-webhooks',
    section: 'Discord webhooks',
  },

  // ── Plugin, login and chat ────────────────────────────────────────────────────────────────────
  {
    id: 'plugin-token',
    label: 'Plugin token',
    description: 'The token the Anvil RuneLite plugin signs in with. Sign in with Discord in the panel sets it for you.',
    keywords: ['token', 'plugin token', 'account token', 'runelite', 'api key', 'paste token', 'rotate', 'plugin connection'],
    href: '/settings/plugin#plugin-token',
    section: 'Plugin connection',
  },
  {
    id: 'plugin-sign-ins',
    label: 'Computers signed in',
    description: 'Each RuneLite that signed in with Discord; revoke one, or link another computer with a code.',
    keywords: ['devices', 'computers', 'revoke', 'sign in', 'link device', 'code', 'runelite', 'plugin connection'],
    href: '/settings/account#plugin-sign-ins',
    section: 'Login & devices',
  },
  {
    id: 'sign-out',
    label: 'Sign out everywhere',
    description: 'End every session on the site and in the plugin.',
    keywords: ['sign out', 'log out', 'logout', 'sessions', 'security', 'hacked'],
    href: '/settings/account#sessions',
    section: 'Login & devices',
  },
  {
    id: 'chat-feed',
    label: 'In-game chat feed',
    description: 'Other players’ drops and achievements in your RuneLite chatbox, where from, and its colours.',
    keywords: ['chat feed', 'feed', 'chatbox', 'in game chat', 'game chat', 'colours', 'colors', 'runelite'],
    href: '/settings/chat#chat-feed',
    section: 'In-game chat',
  },
  {
    id: 'login-brief',
    label: 'Login brief',
    description: 'The short brief in chat when you log in.',
    keywords: ['login', 'log in', 'brief', 'welcome message', 'summary'],
    href: '/settings/chat#chat-feed',
    section: 'In-game chat',
  },

  // ── Characters and privacy ────────────────────────────────────────────────────────────────────
  {
    id: 'add-character',
    label: 'Add a character',
    description: 'Link a character by name, or accept one the plugin saw you play.',
    keywords: ['add account', 'link account', 'new character', 'alt', 'rsn', 'accounts', 'characters', 'detected'],
    href: '/settings/add#link-account',
    section: 'Characters',
  },
  {
    id: 'character-clans',
    label: 'A character’s clans',
    description: 'Which clans each character posts in, and leaving one.',
    keywords: ['clans', 'leave clan', 'home clan', 'guest', 'accounts', 'characters'],
    href: '/settings/characters#clans',
    section: 'Characters',
  },
  {
    id: 'main-character',
    label: 'Main character, rename or remove',
    description: 'Make a character your main, ask for a name change, or unlink it.',
    keywords: ['main', 'primary', 'rename', 'name change', 'remove', 'unlink', 'delete account', 'accounts', 'characters'],
    href: '/settings/characters#character',
    section: 'Characters',
  },
  {
    id: 'character-visibility',
    label: 'Who sees each character',
    description: 'Give a character a public page and a place on cross-clan leaderboards, or keep it to its clans.',
    keywords: ['public', 'private', 'hide', 'share', 'leaderboards', 'visibility', 'privacy', 'accounts', 'characters'],
    href: '/settings/privacy#character-visibility',
    section: 'Who sees your characters',
  },
  {
    id: 'link-characters',
    label: 'Show my characters are one person',
    description: 'Link your public characters to each other, and choose whether other clans’ boards show on your home.',
    keywords: ['link accounts', 'alts', 'same person', 'discover', 'public boards', 'privacy'],
    href: '/settings/privacy#across-anvil',
    section: 'Who sees your characters',
  },
  {
    id: 'claims',
    label: 'Ownership claims',
    description: 'Answer someone who says a character of yours is theirs, or follow your own claim.',
    keywords: ['claim', 'this is my account', 'stolen', 'not mine', 'dispute', 'ownership'],
    href: '/settings/claims#claims-on-yours',
    section: 'Ownership claims',
  },

  // ── Supporter and looks ───────────────────────────────────────────────────────────────────────
  {
    id: 'name-colours',
    label: 'Name colours',
    description: 'The colour and style your name wears on boards, rosters, Discord posts and other players’ game chat.',
    keywords: ['name colour', 'name color', 'colours', 'colors', 'flair', 'gradient', 'supporter', 'style'],
    href: '/settings/supporter#name-colours',
    section: 'Supporter',
  },
  {
    id: 'supporter',
    label: 'Supporter membership',
    description: 'Your tier, what each perk needs, billing and your invite link.',
    keywords: ['supporter', 'champion', 'patron', 'membership', 'subscription', 'perks', 'billing', 'invite', 'referral', 'gumroad'],
    href: '/settings/supporter#perks',
    section: 'Supporter',
  },
  {
    id: 'boosts',
    label: 'Clan boosts',
    description: 'As a Champion or Patron, put your boosts on clans you are in.',
    keywords: ['boost', 'boosts', 'boost clan', 'nitro'],
    href: '/settings/boosts',
    section: 'Supporter',
  },
  {
    id: 'avatar-banner',
    label: 'Avatar and banner',
    description: 'Your own picture and banner, animated, on your profile and plugin card.',
    keywords: ['avatar', 'banner', 'picture', 'gif', 'profile look', 'image'],
    href: '/settings/look#avatar-banner',
    section: 'Profile look',
  },
  {
    id: 'display-case',
    label: 'Display case',
    description: 'Pin your best drops, kill counts and times to your profile.',
    keywords: ['display case', 'pins', 'showcase', 'best drops', 'profile look'],
    href: '/settings/look#display-case',
    section: 'Profile look',
  },
  {
    id: 'connections',
    label: 'Streaming accounts',
    description: 'Link Twitch, YouTube, Kick or Medal.',
    keywords: ['twitch', 'youtube', 'kick', 'medal', 'stream', 'streamer', 'connected accounts'],
    href: '/settings/connections',
    section: 'Connected accounts',
  },
];

/** The path part of an href: no #anchor, no ?query. */
export function memberPathOf(href: string): string {
  return href.split(/[?#]/)[0];
}

/**
 * `/settings/characters…` is "your main character's page": point it at that character, keeping the
 * #anchor, or at Add a character when there is none yet.
 */
export function resolveMemberHref(href: string, mainAccountId: number | null): string {
  if (memberPathOf(href) !== '/settings/characters') return href;
  if (mainAccountId == null) return '/settings/add#link-account';
  const at = href.indexOf('#');
  return `/settings/characters/${mainAccountId}${at >= 0 ? href.slice(at) : ''}`;
}

/** Settings matching every word of the query, best first. */
export function searchMemberSettings(query: string, limit = 8): MemberSettingEntry[] {
  return searchSettings(query, MEMBER_SETTINGS, limit);
}
