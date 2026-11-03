// Lab-session rules the browser needs too (lib/lab is server-only).

/** How long an ended session is kept for a look back before the sweep deletes it. */
export const LAB_KEEP_DAYS = 7;

/** The lab clan's address. Reserved in lib/clanNames so nobody can found a clan there. Lives here,
 * not in lib/lab, so light readers (the clan switcher) can name it without importing the lab. */
export const LAB_CLAN_SLUG = 'anvil-lab';

/**
 * The Supporter lab's test clanmates (lib/labSupporter) have logins whose Discord id starts with
 * this, which no real Discord id can. Anything counting real people leaves them out by it.
 */
export const LAB_DUMMY_LOGIN = 'lab-dummy-';
