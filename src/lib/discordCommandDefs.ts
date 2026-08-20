// The slash commands Anvil registers with Discord.
//
// Deliberately its own module with NO database imports: scripts/register-discord-commands.mts runs
// this against Discord's API from a laptop or a container shell, and dragging `@/db` in would make
// registering a command require a working database connection.
//
// This is the single source of truth for the command tree. The dispatcher in lib/discordCommands
// answers exactly these names — a command registered here with no case there shows up in Discord's
// autocomplete and then fails in front of a member, which is worse than not existing.

import { OPTION_TYPE } from '@/lib/discordInteractions';

export const COMMAND_NAME = 'bingo';

const SHARE_OPTION = {
  name: 'share',
  description: 'Post the answer publicly instead of only to you',
  type: OPTION_TYPE.BOOLEAN,
  required: false,
};

export const COMMAND_DEFINITIONS = [
  {
    name: COMMAND_NAME,
    description: 'Anvil — check the clan board',
    // Guild-only: every answer needs a clan context, and a DM has none.
    contexts: [0],
    options: [
      {
        name: 'board',
        description: 'The board that is running right now',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [SHARE_OPTION],
      },
      {
        name: 'leaderboard',
        description: 'Team standings',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [SHARE_OPTION],
      },
      {
        name: 'rules',
        description: 'How this board works — scoring, reveals, proof, plus the clan house rules',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [SHARE_OPTION],
      },
      {
        name: 'me',
        description: 'Your team, your tiles, your standing',
        type: OPTION_TYPE.SUB_COMMAND,
        options: [SHARE_OPTION],
      },
      {
        name: 'team',
        description: "A team's card — score, roster, recent tiles",
        type: OPTION_TYPE.SUB_COMMAND,
        options: [
          { name: 'name', description: 'Team name (leave blank for your own team)', type: OPTION_TYPE.STRING, required: false },
          SHARE_OPTION,
        ],
      },
    ],
  },
] as const;
