// The slash-command reference the guide renders (/guide/commands), flattened straight from the
// definitions Anvil registers with Discord (lib/discordCommandDefs). Generated, never hand-copied: a
// command, option, choice or limit added there shows up in the guide on the next deploy, and a removed
// one disappears — so the guide can't document a parameter the bot no longer accepts.

import { COMMAND_DEFINITIONS } from '@/lib/discordCommandDefs';
import { OPTION_TYPE } from '@/lib/discordInteractions';

/** How a member fills an option in, in the terms they see in Discord's picker. */
export type OptionKind = 'text' | 'number' | 'member' | 'choice' | 'search' | 'yesno';

export interface GuideCommandOption {
  name: string;
  required: boolean;
  kind: OptionKind;
  description: string;
  choices: string[];
  min: number | null;
  max: number | null;
}

export interface GuideCommand {
  /** `bingo board`, `stats pbs`, `sotw` — the key the guide's examples are written against. */
  path: string;
  /** `/bingo` for the board commands, the rest are clan-wide. */
  group: 'bingo' | 'clan';
  /** The top-level command — the card a subcommand is grouped under. */
  root: string;
  /** What the picker shows, e.g. `/coffer add <amount> [note]`. */
  usage: string;
  description: string;
  options: GuideCommandOption[];
}

interface RawOption {
  name: string;
  description: string;
  type: number;
  required?: boolean;
  autocomplete?: boolean;
  choices?: readonly { name: string; value: string | number }[];
  min_value?: number;
  max_value?: number;
  options?: readonly RawOption[];
}

function kindOf(o: RawOption): OptionKind {
  if (o.type === OPTION_TYPE.USER) return 'member';
  if (o.type === OPTION_TYPE.BOOLEAN) return 'yesno';
  if (o.autocomplete) return 'search';
  if (o.choices && o.choices.length > 0) return 'choice';
  if (o.type === OPTION_TYPE.INTEGER) return 'number';
  return 'text';
}

function toOption(o: RawOption): GuideCommandOption {
  return {
    name: o.name,
    required: o.required === true,
    kind: kindOf(o),
    description: o.description,
    choices: (o.choices ?? []).map((c) => c.name),
    min: o.min_value ?? null,
    max: o.max_value ?? null,
  };
}

function usageOf(path: string, options: GuideCommandOption[]): string {
  // Required first, the way Discord's picker orders them.
  const parts = [...options.filter((o) => o.required), ...options.filter((o) => !o.required)].map((o) =>
    o.required ? `<${o.name}>` : `[${o.name}]`,
  );
  return [`/${path}`, ...parts].join(' ');
}

/** Every command a member can type, one entry per subcommand, in registration order. */
export function guideCommands(): GuideCommand[] {
  const out: GuideCommand[] = [];
  for (const cmd of COMMAND_DEFINITIONS as unknown as { name: string; description: string; options?: readonly RawOption[] }[]) {
    const group = cmd.name === 'bingo' ? 'bingo' : 'clan';
    const opts = cmd.options ?? [];
    const subs = opts.filter((o) => o.type === OPTION_TYPE.SUB_COMMAND);
    if (subs.length > 0) {
      for (const sub of subs) {
        const path = `${cmd.name} ${sub.name}`;
        const options = (sub.options ?? []).map(toOption);
        out.push({ path, group, root: cmd.name, usage: usageOf(path, options), description: sub.description, options });
      }
    } else {
      const options = opts.map(toOption);
      out.push({ path: cmd.name, group, root: cmd.name, usage: usageOf(cmd.name, options), description: cmd.description, options });
    }
  }
  return out;
}
