import type { GuidePage } from './index';

// What people actually type when they are looking for a guide.
//
// Searching the guide titles alone answers almost nothing: nobody types "Building a board that
// tracks itself", they type "tiles", "csv", or "my drops aren't showing". So each guide carries a
// bag of terms that should find it — the words for the thing, the jargon for the thing, and the
// symptom you have when you need that page.
//
// DELIBERATELY NOT TRANSLATED. Nearly all of it is either OSRS/Discord jargon that is the same in
// every language (CoX, ToB, clog, RSN, webhook, Discord) or an English word a search box gets typed
// into out of habit. The translated title, eyebrow and blurb are searched as well, so a Danish
// reader typing a Danish word still finds the page — this table is the extra net underneath, not
// the only one. Adding a locale's own words here later is additive and breaks nothing.
export const SEARCH_TERMS: Record<Exclude<GuidePage, ''>, string[]> = {
  creators: [
    'streamer', 'streaming', 'stream', 'creator', 'creator space', 'space', 'host', 'hosting',
    'twitch', 'kick', 'youtube', 'obs', 'stream overlay', 'browser source', '!join', 'chat bot',
    'followers', 'subs', 'subscribers', 'sub only', 'members', 'boosters', 'gate', 'who can join',
    'viewers', 'no clan', 'advertise', 'listed', 'directory', 'plan', 'players per event', 'billing',
    'approve', 'approval', 'waiting for your yes',
  ],
  'joining-a-streamer-event': [
    'viewer', 'join', 'joining', 'streamer event', 'stream link', 'link twitch', 'kick code',
    'get kick code', 'youtube subscription', 'sub only', 'follower only', 'event is full', 'full',
    'not subbed', 'won’t let me in', "won't let me in", 'cant join', "can't join", 'connected accounts',
    'ask to join', 'waiting for the host',
  ],
  'streaming-for-clans': [
    'streaming', 'stream', 'clan stream', 'viewers', 'members and viewers', 'members only',
    'event players', 'past viewers', 'open to viewers', 'public clan',
  ],
  tiles: [
    'tile rules', 'rules', 'limits', 'limitations', 'requirements', 'before you start', 'why',
    'not counting', 'not completing', 'collection log', 'clog', 'setting', 'chat setting',
    'new addition', 'plugin version', 'too old', 'hiscores', 'ranked', 'unranked', 'combo',
    'screenshot', 'pet', 'gotr', 'energy', 'slayer', 'lap counter', 'party size', 'raid level',
  ],
  switching: [
    'dink', 'wom', 'wise old man', 'migrate', 'migrating', 'switch', 'switching', 'move', 'moving',
    'competition', 'competitions', 'sotw', 'botw', 'clan list', 'wom group',
  ],
  clan: [
    'clan', 'create', 'start', 'new', 'make', 'register', 'setup', 'set up', 'owner',
    'address', 'slug', 'url', 'subdomain', 'name', 'rename', 'free', 'first',
  ],
  discord: [
    'discord', 'bot', 'webhook', 'hook', 'channel', 'server', 'guild', 'invite', 'role', 'roles',
    'nickname', 'nick', 'rank', 'ping', 'mention', 'announce', 'announcement', 'notification',
    'notify', 'slash', 'command', 'commands', 'embed', 'post', 'posting', 'silent', 'quiet',
    'not posting', 'permissions',
  ],
  plugin: [
    'plugin', 'runelite', 'install', 'hub', 'client', 'token', 'link', 'linking', 'verify',
    'verification', 'rsn', 'account', 'character', 'sync', 'roster', 'tracking', 'not tracking',
    'not showing', 'drops', 'overlay', 'sidebar', 'sign in', 'login', 'log in', 'warning',
    'third party', '3rd party', 'ip address', 'privacy',
  ],
  admin: [
    'admin', 'event', 'events', 'run', 'running', 'host', 'hosting', 'launch', 'start', 'signup',
    'sign-ups', 'sign ups', 'open', 'close', 'end', 'finish', 'schedule', 'announce', 'first event',
  ],
  board: [
    'board', 'tile', 'tiles', 'csv', 'xlsx', 'spreadsheet', 'import', 'export', 'bulk', 'authoring',
    'points', 'detect', 'detection', 'track', 'tracking', 'kc', 'killcount', 'xp', 'drop', 'clog',
    'collection log', 'combat achievement', 'ca', 'diary', 'quest', 'balance',
  ],
  captain: [
    'captain', 'captains', 'team', 'teams', 'draft', 'drafting', 'pick', 'picks', 'shortlist',
    'war room', 'roster', 'lineup',
  ],
  formats: [
    'format', 'formats', 'mode', 'modes', 'classic', 'leagues', 'race', 'ladder', 'snake',
    'showdown', 'lucky draw', 'bounty', 'reveal', 'hidden', 'mission', 'missions', 'rules',
  ],
  fees: [
    'fee', 'fees', 'pay', 'payment', 'payout', 'payouts', 'prize', 'prizes', 'gp', 'money', 'buy-in',
    'buyin', 'entry', 'treasurer', 'coffer', 'pot', 'split',
  ],
  coffer: [
    'coffer', 'pot', 'bank', 'donation', 'donations', 'donate', 'donor', 'donors', 'gp', 'money',
    'prize', 'prizes', 'prize pool', 'reward', 'rewards', 'ladder', 'split', 'tie', 'top donors',
    'balance', 'owed', 'unfunded', 'treasurer', 'adjustment', 'sotw prize', 'botw prize',
  ],
  moderator: [
    'moderator', 'mod', 'mods', 'staff', 'proof', 'proofs', 'approve', 'approval', 'reject',
    'screenshot', 'review', 'queue', 'rota', 'evidence', 'dispute',
  ],
  'clan-vs-clan': [
    'clan vs clan', 'cvc', 'versus', 'vs', 'multi clan', 'multiclan', 'cross clan', 'co-host',
    'cohost', 'co host', 'visiting', 'guest', 'guests', 'invite link', 'other clan', 'together',
    'shared', 'pool',
  ],
  commands: [
    'command', 'commands', 'slash', 'slash command', '/bingo', '/stats', '/sotw', '/botw', '/eff',
    'options', 'parameters', 'params', 'usage', 'syntax', 'pbs', 'personal best', 'clog', 'luck',
    'ehp', 'ehb', 'leaderboard', 'standings', 'autocomplete', 'share', 'help',
  ],
};
