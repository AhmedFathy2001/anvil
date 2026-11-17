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

/**
 * What each command can be asked, as a member types it. The card on the Discord page lists these so
 * an admin can see everything the eight commands cover; tests/discord-command-toggles.test.ts pins
 * the subcommand names to the registered definitions (lib/discordCommandDefs), so a new subcommand
 * can't ship without a line here. Kept as plain data: the definitions pull in the dictionaries, and
 * this is read by a client component.
 */
export const COMMAND_USES: Record<(typeof TOGGLEABLE_COMMANDS)[number]['name'], { form: string; sub: string | null; help: string }[]> = {
  bingo: [
    { form: '/bingo board', sub: 'board', help: 'The board that is running right now' },
    { form: '/bingo leaderboard', sub: 'leaderboard', help: 'Team standings' },
    { form: '/bingo me', sub: 'me', help: 'Your team, your tiles, your standing' },
    { form: '/bingo team [name]', sub: 'team', help: 'A team’s card: score, roster, recent tiles. Blank is your own team' },
    { form: '/bingo next', sub: 'next', help: 'The next reveal, mission or deadline' },
    { form: '/bingo rules', sub: 'rules', help: 'How this board works, plus the clan’s house rules' },
    { form: '/bingo apply', sub: 'apply', help: 'How to get in: sign-ups, the fee, and where you stand' },
    { form: '/bingo help', sub: 'help', help: 'What Anvil can tell you in this server' },
  ],
  stats: [
    { form: '/stats profile [player]', sub: 'profile', help: 'Overview: levels, hours, collection log, personal bests' },
    { form: '/stats levels [player]', sub: 'levels', help: 'Skill levels and XP' },
    { form: '/stats efficiency [player]', sub: 'efficiency', help: 'Hours played and hours bossed, and where each comes from' },
    { form: '/stats clog [page] [player]', sub: 'clog', help: 'Collection log overall, or one boss’s page' },
    { form: '/stats pbs [page] [mode] [size] [player]', sub: 'pbs', help: 'Personal bests: all, or one activity' },
    { form: '/stats luck [player]', sub: 'luck', help: 'Drop luck across tracked drops' },
    { form: '/stats collectors', sub: 'collectors', help: 'Clan leaderboard: the top collection logs' },
    { form: '/stats luckboard', sub: 'luckboard', help: 'Clan leaderboard: the driest and the luckiest' },
  ],
  sotw: [{ form: '/sotw', sub: null, help: 'Live standings for the running Skill of the Week' }],
  botw: [{ form: '/botw', sub: null, help: 'Live standings for the running Boss of the Week' }],
  eff: [{ form: '/eff [metric]', sub: null, help: 'The hours played or hours bossed leaderboard, and where you rank' }],
  coffer: [
    { form: '/coffer balance', sub: 'balance', help: 'Balance, top donors and recent movements' },
    { form: '/coffer add <amount> [donor] [note]', sub: 'add', help: 'Add gp. Treasurer, admin or owner only' },
    { form: '/coffer remove <amount> [note]', sub: 'remove', help: 'Remove gp. Treasurer, admin or owner only' },
  ],
  guide: [{ form: '/guide <guide>', sub: null, help: 'Post a guide’s summary and link. Start typing its name' }],
  setup: [{ form: '/setup <topic> [step]', sub: null, help: 'A setup guide: the overview, or one step with a link' }],
};

const NAMES = new Set<string>(TOGGLEABLE_COMMANDS.map((c) => c.name));

export function parseCommandsOff(raw: string | null | undefined): Set<string> {
  try {
    const v = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && NAMES.has(x)) : []);
  } catch {
    return new Set();
  }
}
