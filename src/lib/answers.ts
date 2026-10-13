// What Anvil is, said plainly — the copy search engines and AI answers quote.
//
// WHY THIS EXISTS. The landing argues ("everything your clan does, already counted"); it never states.
// A search engine assembling an answer to "osrs clan bingo plugin" wants a sentence it can lift
// whole: what the thing is, who it's for, what it costs. Those sentences live here, ONCE, and every
// surface that needs them reads from this file — the FAQ on the apex home, the /features pages,
// their FAQPage/SoftwareApplication JSON-LD, and /llms.txt. Four copies written by hand would drift,
// and a structured-data answer that disagrees with the page is a guidelines violation.
//
// PURE — no `@/db`, no React — so the llms.txt route and tests can import it.
//
// EVERY CLAIM HERE MUST BE TRUE OF THE PRODUCT. Prices come from PLANS rather than being restated,
// counts from the same tables the landing derives its figures from. No competitor is named: what we
// can say honestly about someone else's tool is less than what a reader assumes we're saying.

import { PLANS } from '@/lib/plans';
import { EVENT_MODES } from '@/lib/eventModes';

export interface Faq {
  q: string;
  a: string;
}

const price = (n: number | null) => (n == null ? '' : `$${n.toFixed(2)}`);

/** The one-sentence definition. Lead of llms.txt, the FAQ's first answer, every feature page's footer. */
export const ANVIL_DEFINITION =
  'Anvil is a clan events platform for Old School RuneScape: a website plus a RuneLite plugin that runs clan bingos, tile races, ladders, Skill of the Week, Boss of the Week and clan-vs-clan events, and tracks drops, kill counts, XP and personal bests automatically while members play.';

export const GENERAL_FAQ: Faq[] = [
  { q: 'What is Anvil?', a: ANVIL_DEFINITION },
  {
    q: 'Is there a RuneLite plugin for OSRS clan bingo?',
    a: 'Yes. The Anvil plugin is on the RuneLite Plugin Hub — search "Anvil". It credits bingo tiles automatically: item drops, boss kill counts, skill XP, NPC kills, timed clears, raids, agility laps, achievement diaries, combat achievements, PvP kills and more. Members install it once and it works for every clan and event they join.',
  },
  {
    q: 'Is Anvil free?',
    a: `Clans of up to ${PLANS.free.capLabel.replace(/^Up to /, '')} can run events on the free tier, with every event format included. Bigger rosters pay by size — from ${price(PLANS.bronze.priceUsd)} a month for ${PLANS.bronze.capLabel.replace(/^Up to /, '')} up to ${price(PLANS.gold.priceUsd)} a month for ${PLANS.gold.capLabel.replace(/^Up to /, '')} — with a 30-day trial. Players never pay; the plugin is free.`,
  },
  {
    q: 'What event formats does Anvil support?',
    a: `${EVENT_MODES.map((m) => m.label).join(', ')}, plus Skill of the Week and Boss of the Week. Any of them can be played clan against clan.`,
  },
  {
    q: 'Do members need screenshots to prove drops?',
    a: 'Not for anything the plugin can see. Drops, kills, XP, laps, clears and the rest are credited the moment they happen, to the right player, with a tamper-evident screenshot attached. Tiles the plugin cannot verify — or members who do not run it — fall back to a screenshot submitted on the site and approved by a team captain.',
  },
  {
    q: 'How do I run Skill of the Week or Boss of the Week in my clan?',
    a: 'Start a clan on Anvil and schedule a weekly competition. Every member on the roster is enrolled automatically, standings update from the hiscores and the plugin, and the bot posts the start, the standings and the winner to Discord. There is no board to build.',
  },
  {
    q: 'Does Anvil work with Discord?',
    a: 'Yes. Sign-in is Discord. The Anvil bot posts drops, deaths, standings and winners to the channels you choose, syncs roles and nicknames from the roster, builds private team channels for a draft, and answers slash commands like /bingo and /sotw in 15 languages.',
  },
  {
    q: 'Can two clans play the same bingo?',
    a: 'Yes. A host clan invites another clan, or posts an open challenge. Both rosters play one board; the visiting clan joins through one invite link per team, and its own moderator can approve its own members’ proof — nobody has to leave their clan or swap Discords.',
  },
  {
    q: 'How is this different from a spreadsheet and a screenshots channel?',
    a: 'A spreadsheet needs someone to read every screenshot, check it, and type it in — for the whole event. Anvil’s plugin reports what happened in the game directly, credits the right player and team, and keeps the board and standings current on one page, so the organiser can play instead of doing data entry.',
  },
];

/** A page that answers one search, end to end. Rendered at /features/<slug>. */
export interface FeaturePage {
  slug: string;
  /** The <title> and the H1's job: say what this page answers, in the words people search with. */
  title: string;
  h1: string;
  /** Meta description and the lede — the paragraph a search engine is most likely to quote. */
  summary: string;
  sections: { heading: string; body: string }[];
  faq: Faq[];
  /** The guide that goes deeper, if there is one. */
  guide?: { href: string; label: string };
}

export const FEATURE_PAGES: FeaturePage[] = [
  {
    slug: 'osrs-clan-bingo',
    title: 'OSRS Clan Bingo, Tracked Automatically — Anvil',
    h1: 'OSRS clan bingo, without the screenshot channel',
    summary:
      'Run an Old School RuneScape clan bingo where drops, kill counts and XP fill the board themselves. Anvil holds the board, teams and standings; its RuneLite plugin credits each tile to the right player the moment it happens.',
    sections: [
      {
        heading: 'Build the board once',
        body: 'Pick a format — classic bingo with rows and columns, a Leagues-style board, a tile race, or a hidden-tile showdown — and fill it with tiles. A tile can ask for a drop, a set of items, a boss kill count, skill XP, NPC kills, a timed clear, a deathless raid, agility laps, diaries, combat achievements, PvP kills, Last Man Standing placings or loot value. Import a whole board from a spreadsheet if you already have one.',
      },
      {
        heading: 'The plugin fills it in',
        body: 'Members install the Anvil plugin from the RuneLite Plugin Hub and link their account once. During the event it reports drops, kills, XP and clears as they happen, credits the right player on the right team, and attaches a tamper-evident screenshot. No one has to post proof in a channel and no one has to check it by hand.',
      },
      {
        heading: 'Teams, drafts and Discord',
        body: 'Sign-ups take a form you design. Captains can draft teams live, or you can assign them. The Discord bot announces the start, posts big drops and standings, builds private team channels, and shows the live board with /bingo. When it ends, the standings are already settled.',
      },
    ],
    faq: [
      GENERAL_FAQ[1],
      GENERAL_FAQ[4],
      {
        q: 'Can I import a bingo board from a spreadsheet?',
        a: 'Yes. Anvil reads tiles from CSV or .xlsx, and exports the same format, so a board you already planned in Google Sheets or Excel can be brought in whole.',
      },
      GENERAL_FAQ[2],
    ],
    guide: { href: '/guide/board', label: 'Board guide' },
  },
  {
    slug: 'skill-and-boss-of-the-week',
    title: 'Skill of the Week & Boss of the Week Tracker for OSRS Clans — Anvil',
    h1: 'Skill of the Week and Boss of the Week, run for you',
    summary:
      'Anvil runs SOTW and BOTW competitions for Old School RuneScape clans: everyone on the roster is enrolled automatically, gains are tracked from the hiscores and the RuneLite plugin, and the winner is posted to Discord when the week ends.',
    sections: [
      {
        heading: 'Nothing to build',
        body: 'Choose a skill, a boss, or an efficiency measure and a start date. Every member on the roster is entered automatically — no sign-up thread, no list of names to keep in sync.',
      },
      {
        heading: 'Live standings',
        body: 'Gains are measured from each player’s starting point. Members running the plugin report as they play; everyone else is read from the hiscores. The leaderboard page and the /sotw and /botw Discord commands show the same live standings.',
      },
      {
        heading: 'Winners and prizes',
        body: 'When the week closes, the result is posted to Discord automatically. Prize places can be set per competition and paid from the clan coffer, with ties split fairly if you choose.',
      },
    ],
    faq: [
      GENERAL_FAQ[5],
      {
        q: 'Do members have to sign up for Skill of the Week?',
        a: 'No. Every member on the clan roster is enrolled automatically, and the roster itself stays in sync from the game through the plugin.',
      },
      GENERAL_FAQ[6],
    ],
  },
  {
    slug: 'clan-vs-clan',
    title: 'Clan vs Clan Events for OSRS — Bingo Between Clans — Anvil',
    h1: 'Clan vs clan, on one board',
    summary:
      'Anvil lets two Old School RuneScape clans play the same bingo, tile race or ladder. The host invites the other clan; each side plays from its own clan page, and the plugin credits both rosters on one shared board.',
    sections: [
      {
        heading: 'Invite a rival, or post a challenge',
        body: 'Invite a clan you already know, or post an open challenge for any clan to accept. Every clan already lives on the same platform, so there is no second site to set up and no shared spreadsheet.',
      },
      {
        heading: 'Each clan runs its own side',
        body: 'The visiting clan joins through one invite link per team — no collecting names by hand. A staff seat lets their own moderator run their team, approve their own members’ proof and handle fees, without an admin account on the host clan.',
      },
      {
        heading: 'One board, two rosters',
        body: 'Both sides are tracked by the same plugin under the same rules, so the result is not a matter of whose screenshots were counted. Players keep their own account and history; they get a seat for the event and nothing more.',
      },
    ],
    faq: [GENERAL_FAQ[7], GENERAL_FAQ[1]],
    guide: { href: '/guide/clan-vs-clan', label: 'Hosting a visiting clan' },
  },
  {
    slug: 'runelite-clan-events-plugin',
    title: 'RuneLite Plugin for OSRS Clan Events — Anvil',
    h1: 'The RuneLite plugin for clan events',
    summary:
      'Anvil is a RuneLite Plugin Hub plugin plus a website for running Old School RuneScape clan events. It auto-credits bingo tiles, tracks Skill and Boss of the Week, syncs the clan roster, and keeps collection logs and personal bests current.',
    sections: [
      {
        heading: 'Install once, every clan',
        body: 'Search "Anvil" in the RuneLite Plugin Hub and install it. Link your account once and the plugin works for every clan and event you are part of — guesting in another clan’s event needs nothing new.',
      },
      {
        heading: 'What it tracks',
        body: 'Item drops, boss kill counts, skill XP, NPC kills, timed clears and raids, agility laps, gathering, achievement diaries, combat achievements, PvP kills, Last Man Standing and loot value — each credited to the right event tile and player as it happens, with a tamper-evident screenshot.',
      },
      {
        heading: 'Between events',
        body: 'The plugin also syncs the collection log, personal bests, quests and diaries, so boards can ask for things you have not done yet, and it captures pets, uniques and deaths as clan highlights. For admins, it syncs the clan roster from the in-game clan list in one click.',
      },
    ],
    faq: [GENERAL_FAQ[1], GENERAL_FAQ[4], GENERAL_FAQ[0]],
    guide: { href: '/guide/plugin', label: 'Plugin setup guide' },
  },
];

export function featurePage(slug: string): FeaturePage | undefined {
  return FEATURE_PAGES.find((p) => p.slug === slug);
}
