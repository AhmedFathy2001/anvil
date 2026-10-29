// Slash commands a clan has switched off on its Discord page. Discord registers them once for every
// server (lib/discordCommandSync), so a switched-off command still appears; asking it answers that
// the clan turned it off. Pure.

export const COMMANDS_OFF_KEY = 'discord_commands_off';

/** The commands a clan can switch off, as Discord names them. */
export const TOGGLEABLE_COMMANDS = [
  { name: 'bingo', label: '/bingo', help: 'The running board, standings, rules, your team' },
  { name: 'stats', label: '/stats', help: 'Profiles, levels, collection log, PBs, luck' },
  { name: 'sotw', label: '/sotw', help: 'Skill of the week standings' },
  { name: 'botw', label: '/botw', help: 'Boss of the week standings' },
  { name: 'eff', label: '/eff', help: 'The efficiency leaderboard' },
  { name: 'coffer', label: '/coffer', help: 'The clan’s gp balance' },
  { name: 'guide', label: '/guide', help: 'Setup and gear guides' },
  { name: 'setup', label: '/setup', help: 'Step-by-step Anvil setup help' },
] as const;

const NAMES = new Set<string>(TOGGLEABLE_COMMANDS.map((c) => c.name));

export function parseCommandsOff(raw: string | null | undefined): Set<string> {
  try {
    const v = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && NAMES.has(x)) : []);
  } catch {
    return new Set();
  }
}
