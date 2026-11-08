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
    'viewers', 'no clan', 'advertise', 'listed', 'directory', 'plan', 'players per event', 'players at once', 'billing',
    'approve', 'approval', 'waiting for your yes', 'space settings', 'your page', 'bio', 'banner',
    'logo', 'panels', 'schedule', 'featured', 'highlights', 'clips', 'auto clip', 'report',
  ],
  'joining-a-streamer-event': [
    'viewer', 'join', 'joining', 'streamer event', 'stream link', 'link twitch', 'kick code',
    'get kick code', 'youtube subscription', 'sub only', 'follower only', 'event is full', 'full',
    'not subbed', 'won’t let me in', "won't let me in", 'cant join', "can't join", 'connected accounts',
    'ask to join', 'waiting for the host', 'medal', 'clip my stream', 'report', 'events page',
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
    'address', 'slug', 'url', 'subdomain', 'name', 'rename', 'free', 'first', 'billing', 'portal',
    'plan and billing', 'boost', 'boosts', 'boosted', 'recruiting line', 'recruitment post',
  ],
  discord: [
    'discord', 'bot', 'webhook', 'hook', 'channel', 'server', 'guild', 'invite', 'role', 'roles',
    'nickname', 'nick', 'rank', 'ping', 'mention', 'announce', 'announcement', 'notification',
    'notify', 'slash', 'command', 'commands', 'embed', 'post', 'posting', 'silent', 'quiet',
    'not posting', 'permissions', 'leagues', 'deadman', 'game mode', 'game modes', 'hardcore', 'seasonal',
    'threshold', 'rarity', 'dink', 'old webhooks', 'remove webhook', 'keep webhook', 'post to discord',
    'announcement post',
  ],
  plugin: [
    'plugin', 'runelite', 'install', 'hub', 'client', 'token', 'link', 'linking', 'verify',
    'verification', 'rsn', 'account', 'character', 'sync', 'roster', 'tracking', 'not tracking',
    'not showing', 'drops', 'overlay', 'sidebar', 'sign in', 'login', 'log in', 'warning',
    'third party', '3rd party', 'ip address', 'privacy', 'belongs to another', 'this is my account',
    'ownership', 'claim',
  ],
  admin: [
    'admin', 'event', 'events', 'run', 'running', 'host', 'hosting', 'launch', 'start', 'signup',
    'sign-ups', 'sign ups', 'open', 'close', 'end', 'finish', 'schedule', 'announce', 'first event',
    'team placement', 'auto-balance', 'auto balance', 'players pick', 'solo',
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
    'buyin', 'entry', 'treasurer', 'coffer', 'pot', 'split', 'guest fee', 'remind unpaid', 'unpaid',
  ],
  coffer: [
    'coffer', 'pot', 'bank', 'donation', 'donations', 'donate', 'donor', 'donors', 'gp', 'money',
    'prize', 'prizes', 'prize pool', 'reward', 'rewards', 'ladder', 'split', 'tie', 'top donors',
    'balance', 'owed', 'unfunded', 'treasurer', 'adjustment', 'sotw prize', 'botw prize',
  ],
  people: [
    'roster', 'members', 'member list', 'guest', 'guests', 'join request', 'join requests', 'apply',
    'application', 'needs review', 'who can join', 'ask first', 'let anyone in', 'no guests',
    'add manually', 'remove', 'kick', 'ban', 'banned', 'unban', 'departed', 'left', 'quiet',
    'inactive', 'roster only', 'missing member', 'not on roster', 'showing as guest', 'promote',
    'demote', '#player', 'placeholder', 'claim request', 'visibility', 'members only', 'clan hall',
  ],
  'staff-roles': [
    'roles', 'role', 'staff', 'permissions', 'access', 'who can', 'owner', 'admin', 'treasurer',
    'moderator', 'make moderator', 'promote staff', 'demote staff', 'staff & roles', 'grant',
    'revoke', 'transfer ownership', 'make owner', 'board editor', 'board treasurer', 'team staff',
    'board builder', 'write guides', 'protected',
  ],
  supporter: [
    'supporter', 'champion', 'patron', 'tier', 'tiers', 'perks', 'subscription', 'subscribe', 'membership',
    'gumroad', 'billing', 'price', 'cancel', 'refund', 'name colour', 'name color', 'gradient', 'flair', 'star',
    'gold gz', 'avatar', 'banner', 'animated', 'display case', 'friend event', 'host friends', 'head-to-head',
    'h2h', 'challenge', 'invite', 'referral', 'free months', 'gift', 'downgrade', 'lapse', 'dark background',
    'light background',
  ],
  'side-panel': [
    'side panel', 'sidebar', 'panel', 'tab', 'tabs', 'feed', 'feed tab', 'you tab', 'lookup', 'clan tab',
    'gear', 'event chat', 'chat', 'team chat', 'slow mode', 'reaction', 'reactions', 'gz', 'sad', 'sit',
    'refresh', 'show feed in game chat', 'animated names', 'supporter names in chat', 'supporter names in menus',
    'seasonal', 'leagues', 'season progress', 'sync profile', 'banner sounds', 'compare', 'goals',
  ],
  'clan-boosts': [
    'boost', 'boosts', 'boosting', 'boosted', 'clan boost', 'booster', 'boosters', 'level', 'levels',
    'boost level', 'clan hall', 'featured', 'spotlight', 'recruiting line', 'recruitment post',
    'clan name colour', 'clan name color', 'animated banner', 'gift', 'gifted boost', 'grace', 'paused',
    'move boost', 'first booster', 'badge',
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
  profile: [
    'profile', 'my profile', 'character page', 'public page', 'person page', 'share profile', 'private profile',
    'wrapped', 'monthly wrapped', 'year in review', 'recap card', 'event wrapped', 'share card', 'compare',
    'compare players', 'side by side', 'report profile',
  ],
  settings: [
    'settings', 'preferences', 'screenshot privacy', 'private messages', 'pms', 'hide chat', 'death message',
    'rare drop value', 'drop value', 'webhook', 'my webhook', 'personal webhook', 'devices', 'revoke',
    'sign out everywhere', 'who sees my characters', 'hide character', 'privacy', 'main character', 'make main',
    'remove character', 'ownership claim', 'claims', 'object', 'this is my account', 'login brief', 'chat feed',
  ],
  challenges: [
    'challenge', 'challenges', 'head-to-head', 'h2h', '1v1', 'duel', 'race a friend', 'first to a drop',
    'most kills', 'most xp', 'friends event', 'friend event', 'host friends', 'private board', 'invite link',
    'block challenges',
  ],
  'clan-hall': [
    'clan hall', 'find a clan', 'find clan', 'clan list', 'directory', 'recruiting', 'join a clan',
    'compare clans', 'leaderboard', 'leaderboards', 'top clans', 'ranking', 'events list', 'find an event',
    'public events', 'ghost clan', 'in-game clan', 'not on anvil', 'listed',
  ],
  'in-game-guides': [
    'in-game guides', 'game guides', 'guide library', 'library guide', 'propose a guide', 'write a guide',
    'suggest an edit', 'proposal', 'proposals', 'clan guides', 'copy guide', 'follows library', 'customised',
    'update available', '/guide', 'beginner', 'advanced', 'raid guide', 'boss guide', 'money making',
  ],
  weekly: [
    'skill of the week', 'boss of the week', 'sotw', 'botw', 'weekly', 'weekly competition', 'competition',
    'efficiency race', 'ehp', 'ehb', 'rotate', 'rotation', 'repeat every week', 'starting line', 'baseline',
    'baselines', 'end now', 'weekly prizes', 'xp race',
  ],
  'clan-events': [
    'clan event', 'clan events', 'mass', 'masses', 'raid night', 'drop party', 'meetup', 'rsvp', "i'm going",
    'going', 'schedule', 'calendar', 'fill the gap', 'reminder', 'recurring', 'every week', 'sign-ups', 'spots',
    'event survey', 'cancel event',
  ],
};
