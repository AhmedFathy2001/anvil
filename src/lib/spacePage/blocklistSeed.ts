// The domains a space page starts out unable to link to (migration 0211 seeds promo_blocked_domains
// with exactly this list; tests/creator-panels.test.ts holds the two together). After that the table
// is the truth and platform staff edit it at /staff/promotions.
//
// Jagex's rules forbid promoting real-world trading (gold, items, accounts), paid account services
// (boosting, questing, fire/infernal capes, PKing for hire, account sharing), bots, macros and
// unapproved third-party clients, private servers, and gambling. Shorteners and link hubs are here
// because any of them would carry a blocked link straight past this list.
//
// A domain blocks itself and every subdomain. The list is a seed of well-known names, not an oracle:
// the keyword check on domain names (rules.ts suspiciousDomain) catches the long tail of
// `osrs-gold-*` / `*rsps*` / `*dice*` storefronts, and staff add what reports turn up.
//
// Pure: no database import (tests/pure-module-imports).

export type BlockReason = 'rwt' | 'gambling' | 'bots' | 'rsps' | 'boosting' | 'phishing' | 'shortener' | 'other';

export const BLOCK_REASONS: readonly BlockReason[] = ['rwt', 'gambling', 'bots', 'rsps', 'boosting', 'phishing', 'shortener', 'other'];

export const BLOCK_REASON_LABEL: Record<BlockReason, string> = {
  rwt: 'Gold, item or account selling',
  gambling: 'Gambling',
  bots: 'Bots, macros or unapproved clients',
  rsps: 'Private servers',
  boosting: 'Paid account services',
  phishing: 'Phishing / fake giveaways',
  shortener: 'Link shortener or link hub',
  other: 'Other',
};

export const BLOCKLIST_SEED: readonly { domain: string; reason: BlockReason }[] = [
  // Gold, item and account marketplaces (RWT).
  ...[
    'playerauctions.com',
    'g2g.com',
    'eldorado.gg',
    'probemas.com',
    'sythe.org',
    'epicnpc.com',
    'ownedcore.com',
    'elitepvpers.com',
    'rsorder.com',
    'mmogah.com',
    'igvault.com',
    'rpgstash.com',
    'chicksgold.com',
    'lootbar.gg',
    'u7buy.com',
    'mmoga.com',
    'z2u.com',
    'gameflip.com',
    'accsmarket.com',
    'virtgold.com',
    'goldah.com',
    'mulefactory.com',
    'aoeah.com',
  ].map((domain) => ({ domain, reason: 'rwt' as const })),
  // Paid account services (boosting, questing, capes, account sharing).
  ...['skycoach.gg', 'overgear.com'].map((domain) => ({ domain, reason: 'boosting' as const })),
  // Bots, macros, cheat and unapproved clients. (RuneLite and HDOS are Jagex-approved; these are not.)
  ...[
    'dreambot.org',
    'tribot.org',
    'osbot.org',
    'powerbot.org',
    'runemate.com',
    'epicbot.com',
    'rspeer.org',
    'villavu.com',
    'openosrs.com',
  ].map((domain) => ({ domain, reason: 'bots' as const })),
  // Private servers and their listing sites.
  ...['rune-server.ee', 'rune-server.org', 'moparscape.org', 'runelocus.com', 'rsps-list.com', 'top100arena.com', 'topg.org', 'alora.io', 'roatpkz.com'].map(
    (domain) => ({ domain, reason: 'rsps' as const }),
  ),
  // Gambling: crypto casinos and GP staking sites.
  ...[
    'stake.com',
    'stake.us',
    'roobet.com',
    'rollbit.com',
    'duelbits.com',
    'gamdom.com',
    'bc.game',
    'shuffle.com',
    'runewager.com',
    'csgoroll.com',
    'csgoempire.com',
    'thunderpick.io',
  ].map((domain) => ({ domain, reason: 'gambling' as const })),
  // URL shorteners and link hubs: either one hides where a link really goes.
  ...[
    'bit.ly',
    'bitly.com',
    'tinyurl.com',
    't.co',
    'goo.gl',
    'ow.ly',
    'is.gd',
    'v.gd',
    'buff.ly',
    'cutt.ly',
    'rebrand.ly',
    'shorturl.at',
    'rb.gy',
    'tiny.cc',
    's.id',
    't.ly',
    'bl.ink',
    'short.io',
    'shorte.st',
    'adf.ly',
    'lnkd.in',
    'tr.ee',
    'lnk.bio',
    'snip.ly',
    'qr.ae',
    'urlz.fr',
    'clck.ru',
  ].map((domain) => ({ domain, reason: 'shortener' as const })),
];
