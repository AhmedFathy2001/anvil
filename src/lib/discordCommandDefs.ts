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
// There is no `share` option any more. Discord has no valueless option — every one carries a value,
// so the old flag read as `share: True` in the picker and essentially nobody found it. Sharing is a
// button on the answer instead (lib/discordInteractions shareRow).

import { OPTION_TYPE } from '@/lib/discordInteractions';
import { DISCORD_LOCALES, getDiscordDict } from '@/lib/discordI18n';

export const COMMAND_NAME = 'bingo';

export const COMMAND_DEFINITIONS = [
  {
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
  },
] as const;

/** The subcommand names, in registration order — what `/bingo help` lists and the tests assert. */
export const SUBCOMMAND_ORDER = COMMAND_DEFINITIONS[0].options.map((o) => o.name);

type LocalizationMap = Record<string, string>;

interface LocalizedOption {
  name: string;
  description: string;
  description_localizations?: LocalizationMap;
  type: number;
  required?: boolean;
  options?: LocalizedOption[];
}

/**
 * The command tree with `description_localizations` filled in from the locale files.
 *
 * Only DESCRIPTIONS are localized, never names. A member reading a Danish answer still types
 * `/bingo board` — translating the command name would mean the command a clan's own docs, this
 * repo's guides and every screenshot refer to simply doesn't exist for them.
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

  const root = COMMAND_DEFINITIONS[0];
  return [
    {
      ...root,
      description_localizations: mapFor((d) => d.help.command),
      options: root.options.map((o): LocalizedOption => {
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
    },
  ];
}
