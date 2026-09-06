// The slash commands Anvil registers with Discord.
//
// Deliberately its own module with NO database imports: scripts/register-discord-commands.mts runs
// this against Discord's API from a laptop or a container shell, and dragging `@/db` in would make
// registering a command require a working database connection. lib/discordI18n is fine here — it is
// string tables and dynamic imports, nothing more.
//
// This is the single source of truth for the command tree. The dispatcher in lib/discordCommands
// answers exactly these names — a command registered here with no case there shows up in Discord's
// autocomplete and then fails in front of a member, which is worse than not existing.
//
// /bingo answers about ONE board; the clan-wide commands (/sotw, /botw, /eff, /coffer, /clog, /luck)
// answer about the clan and resolve no event. They are separate top-level commands, not /bingo
// subcommands, because a clan running a Skill of the Week but no bingo should not have to type
// `/bingo sotw`.
//
// There is no `share` option any more. Discord has no valueless option — every one carries a value,
// so the old flag read as `share: True` in the picker and essentially nobody found it. Sharing is a
// button on the answer instead (lib/discordInteractions shareRow).

import { OPTION_TYPE } from '@/lib/discordInteractions';
import { DISCORD_LOCALES, getDiscordDict } from '@/lib/discordI18n';

export const COMMAND_NAME = 'bingo';

const BINGO_DEFINITION = {
  name: COMMAND_NAME,
  description: 'Anvil — check the clan board',
  // Guild-only: every answer needs a clan context, and a DM has none.
  contexts: [0],
  options: [
    { name: 'board', description: 'The board that is running right now', type: OPTION_TYPE.SUB_COMMAND },
    { name: 'leaderboard', description: 'Team standings', type: OPTION_TYPE.SUB_COMMAND },
    {
      name: 'rules',
      description: 'How this board works — scoring, reveals, proof, plus the clan house rules',
      type: OPTION_TYPE.SUB_COMMAND,
    },
    {
      name: 'apply',
      description: 'How to get in — sign-ups, the fee, and where you stand',
      type: OPTION_TYPE.SUB_COMMAND,
    },
    {
      name: 'next',
      description: "What's coming — the next reveal, mission, or deadline",
      type: OPTION_TYPE.SUB_COMMAND,
    },
    { name: 'me', description: 'Your team, your tiles, your standing', type: OPTION_TYPE.SUB_COMMAND },
    { name: 'help', description: 'What Anvil can tell you in here', type: OPTION_TYPE.SUB_COMMAND },
    {
      name: 'team',
      description: "A team's card — score, roster, recent tiles",
      type: OPTION_TYPE.SUB_COMMAND,
      options: [
        {
          name: 'name',
          description: 'Team name (leave blank for your own team)',
          type: OPTION_TYPE.STRING,
          required: false,
        },
      ],
    },
  ],
} as const;

// ── Clan-wide commands ──────────────────────────────────────────────────────────────────────────
//
// A `member` option is a USER, so it re-runs the same clan-scoped identity resolution the invoker
// gets. /coffer carries the bot's only writes, gated in the handler on the member's SITE role.

const MEMBER_OPTION = {
  name: 'member',
  description: 'A member (leave blank for yourself)',
  type: OPTION_TYPE.USER,
  required: false,
} as const;

const AMOUNT_OPTION = {
  name: 'amount',
  description: 'Amount, e.g. 5m or 2500000',
  type: OPTION_TYPE.STRING,
  required: true,
} as const;

const NOTE_OPTION = {
  name: 'note',
  description: "What it's for (optional)",
  type: OPTION_TYPE.STRING,
  required: false,
} as const;

// Ask for one answer in a specific language, overriding the member's own Discord locale (and the
// clan's bot-language setting) for that one reply. Choices come straight from the locale table, so
// every language the bot speaks is offered and none can drift. The handler applies it in
// lib/discordCommands (applyLanguage), where the explicit choice beats everything else.
const LANGUAGE_OPTION = {
  name: 'language',
  description: 'Reply in a specific language (default: your own Discord language)',
  type: OPTION_TYPE.STRING,
  required: false,
  choices: DISCORD_LOCALES.map((l) => ({ name: l.english, value: l.code })),
} as const;

// Type-ahead options (125 pages, per-user account lists — too many/too personal for static choices),
// answered by handleAutocomplete in lib/discordCommands. `autocomplete` and `choices` are mutually
// exclusive to Discord, so these carry neither a choices list nor a hard-coded set.
const PAGE_OPTION = {
  name: 'page',
  description: 'A boss or activity page — type to search (like !log <boss>)',
  type: OPTION_TYPE.STRING,
  required: false,
  autocomplete: true,
} as const;

const ACCOUNT_OPTION = {
  name: 'account',
  description: 'Which account — type to pick (defaults to the main)',
  type: OPTION_TYPE.STRING,
  required: false,
  autocomplete: true,
} as const;

const CLAN_DEFINITIONS = [
  { name: 'sotw', description: 'Skill of the Week — live standings', contexts: [0], options: [LANGUAGE_OPTION] },
  { name: 'botw', description: 'Boss of the Week — live standings', contexts: [0], options: [LANGUAGE_OPTION] },
  {
    name: 'eff',
    description: 'Efficiency (EHP/EHB) leaderboard, and where you rank',
    contexts: [0],
    options: [
      {
        name: 'metric',
        description: 'EHP or EHB (default EHP)',
        type: OPTION_TYPE.STRING,
        required: false,
        choices: [
          { name: 'EHP', value: 'ehp' },
          { name: 'EHB', value: 'ehb' },
        ],
      },
      LANGUAGE_OPTION,
    ],
  },
  {
    name: 'coffer',
    description: 'The clan coffer — balance, donors, and staff add/remove',
    contexts: [0],
    options: [
      {
        name: 'balance',
        description: 'Balance, top donors, and recent movements',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [LANGUAGE_OPTION],
      },
      {
        name: 'add',
        description: 'Add gp to the coffer (treasurer, admin or owner)',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [AMOUNT_OPTION, NOTE_OPTION],
      },
      {
        name: 'remove',
        description: 'Remove gp from the coffer (treasurer, admin or owner)',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [AMOUNT_OPTION, NOTE_OPTION],
      },
    ],
  },
  {
    // The player-stats hub: everything about ONE account, plus the two clan leaderboards that were
    // once their own /clog and /luck commands. A command WITH subcommands (like /coffer), dispatched
    // in lib/discordClanCommands statsResult.
    name: 'stats',
    description: "A player's stats — levels, efficiency, collection log, PBs, luck",
    contexts: [0],
    options: [
      { name: 'profile', description: 'Overview — levels, EHP/EHB, collection log, PBs', type: OPTION_TYPE.SUB_COMMAND, options: [MEMBER_OPTION, ACCOUNT_OPTION, LANGUAGE_OPTION] },
      { name: 'levels', description: 'Skill levels and XP', type: OPTION_TYPE.SUB_COMMAND, options: [MEMBER_OPTION, ACCOUNT_OPTION, LANGUAGE_OPTION] },
      { name: 'efficiency', description: 'EHP and EHB, and where each comes from', type: OPTION_TYPE.SUB_COMMAND, options: [MEMBER_OPTION, ACCOUNT_OPTION, LANGUAGE_OPTION] },
      { name: 'clog', description: "Collection log — overall, or one boss's page", type: OPTION_TYPE.SUB_COMMAND, options: [PAGE_OPTION, ACCOUNT_OPTION, MEMBER_OPTION, LANGUAGE_OPTION] },
      { name: 'pbs', description: 'Personal bests — all, or one activity', type: OPTION_TYPE.SUB_COMMAND, options: [PAGE_OPTION, ACCOUNT_OPTION, MEMBER_OPTION, LANGUAGE_OPTION] },
      { name: 'luck', description: 'Drop luck across tracked drops', type: OPTION_TYPE.SUB_COMMAND, options: [MEMBER_OPTION, ACCOUNT_OPTION, LANGUAGE_OPTION] },
      { name: 'collectors', description: 'Clan leaderboard — the top collection logs', type: OPTION_TYPE.SUB_COMMAND, options: [LANGUAGE_OPTION] },
      { name: 'luckboard', description: 'Clan leaderboard — the driest and the luckiest', type: OPTION_TYPE.SUB_COMMAND, options: [LANGUAGE_OPTION] },
    ],
  },
  {
    name: 'guide',
    description: 'Read a setup guide — the overview or one step, with a link',
    contexts: [0],
    options: [
      {
        name: 'topic',
        description: 'Which guide',
        type: OPTION_TYPE.STRING,
        required: true,
        // Values MUST match GUIDE_OUTLINES keys in lib/discordGuides (asserted in the tests).
        choices: [
          { name: 'Plugin setup', value: 'plugin' },
          { name: 'Discord setup', value: 'discord' },
          { name: 'Boards & tiles', value: 'board' },
          { name: 'Start a clan', value: 'clan' },
          { name: 'Fees & prizes', value: 'fees' },
          { name: 'Event formats', value: 'formats' },
          { name: 'Captain & draft', value: 'captain' },
          { name: 'Running an event', value: 'admin' },
          { name: 'Moderating proof', value: 'moderator' },
          { name: 'Clan vs clan', value: 'clanvsclan' },
        ],
      },
      {
        name: 'step',
        description: 'Jump to a step number (leave blank for the overview)',
        type: OPTION_TYPE.INTEGER,
        required: false,
      },
      LANGUAGE_OPTION,
    ],
  },
] as const;

export const COMMAND_DEFINITIONS = [BINGO_DEFINITION, ...CLAN_DEFINITIONS] as const;

/** The subcommand names of /bingo, in registration order — what `/bingo help` lists and tests assert. */
export const SUBCOMMAND_ORDER = BINGO_DEFINITION.options.map((o) => o.name);

/** Every top-level command name Anvil registers — /bingo plus the clan-wide set. */
export const COMMAND_NAMES = COMMAND_DEFINITIONS.map((c) => c.name);

type LocalizationMap = Record<string, string>;

interface LocalizedOption {
  name: string;
  description: string;
  description_localizations?: LocalizationMap;
  type: number;
  required?: boolean;
  options?: LocalizedOption[];
  choices?: readonly { name: string; value: string }[];
}

/**
 * The command tree with `description_localizations` filled in from the locale files.
 *
 * Only DESCRIPTIONS are localized, never names. A member reading a Danish answer still types
 * `/bingo board` — translating the command name would mean the command a clan's own docs, this
 * repo's guides and every screenshot refer to simply doesn't exist for them.
 *
 * /bingo localizes each subcommand's blurb too (they're the ones members read in the picker); the
 * clan-wide commands localize their top-level description and leave option descriptions English —
 * the ANSWER is what a member reads in their language, and an option label is a one-time glance.
 *
 * Discord ignores locale keys it doesn't know and drops empty maps, so a locale with no Discord
 * equivalent (Arabic has no Discord client language) costs nothing by being absent here.
 */
export async function buildLocalizedCommands(): Promise<unknown[]> {
  const dicts = await Promise.all(
    DISCORD_LOCALES.filter((l) => l.discord.length > 0 && l.code !== 'en').map(async (l) => ({
      locale: l,
      dict: await getDiscordDict(l.code),
    })),
  );

  const mapFor = (pick: (d: Awaited<ReturnType<typeof getDiscordDict>>) => string | undefined): LocalizationMap => {
    const out: LocalizationMap = {};
    for (const { locale, dict } of dicts) {
      const value = pick(dict)?.trim();
      if (!value) continue;
      // Discord caps a command or option description at 100 characters and rejects the whole
      // registration if one is over — a silent, total failure for the sake of one long sentence.
      const clamped = value.length > 100 ? `${value.slice(0, 99).trimEnd()}…` : value;
      for (const code of locale.discord) out[code] = clamped;
    }
    return out;
  };

  const bingo = {
    ...BINGO_DEFINITION,
    description_localizations: mapFor((d) => d.help.command),
    options: BINGO_DEFINITION.options.map((o): LocalizedOption => {
      const sub = o.name as keyof Awaited<ReturnType<typeof getDiscordDict>>['help']['subs'];
      const inner = 'options' in o ? o.options : undefined;
      return {
        name: o.name,
        description: o.description,
        type: o.type,
        description_localizations: mapFor((d) => d.help.subs[sub]),
        ...(inner
          ? {
              options: inner.map((arg) => ({
                name: arg.name,
                description: arg.description,
                type: arg.type,
                required: arg.required,
                description_localizations: mapFor((d) => d.help.optionTeamName),
              })),
            }
          : {}),
      };
    }),
  };

  const clan = CLAN_DEFINITIONS.map((cmd) => ({
    ...cmd,
    // Clone the options so the readonly const isn't handed to the fetch body by reference.
    options: cmd.options.map((o) => ({ ...o })),
    description_localizations: mapFor((d) => (d.commands as Record<string, string | undefined>)[cmd.name]),
  }));

  return [bingo, ...clan];
}
