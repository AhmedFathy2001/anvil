// The Discord page's command card (lib/discordCommandToggles) against what the bot registers
// (lib/discordCommandDefs): every command is listed, and every subcommand has a usage line.
//
// Run: npx tsx --test tests/discord-command-toggles.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_DEFINITIONS } from '../src/lib/discordCommandDefs.ts';
import { OPTION_TYPE } from '../src/lib/discordInteractions.ts';
import { COMMAND_USES, TOGGLEABLE_COMMANDS, parseCommandsOff } from '../src/lib/discordCommandToggles.ts';

test('the card lists exactly the commands the bot registers', () => {
  assert.deepEqual([...TOGGLEABLE_COMMANDS.map((c) => c.name)].sort(), [...COMMAND_DEFINITIONS.map((c) => c.name)].sort());
  assert.deepEqual(Object.keys(COMMAND_USES).sort(), [...COMMAND_DEFINITIONS.map((c) => c.name)].sort());
});

test('every subcommand has a usage line, and no line names one that is not registered', () => {
  for (const def of COMMAND_DEFINITIONS) {
    const subs = ((def.options ?? []) as readonly { name: string; type?: number }[]).filter((o) => o.type === OPTION_TYPE.SUB_COMMAND).map((o) => o.name);
    const uses = COMMAND_USES[def.name as keyof typeof COMMAND_USES];
    assert.ok(uses.length > 0, `${def.name} has at least one line`);
    if (subs.length === 0) {
      assert.deepEqual(uses.map((u) => u.sub), [null], `${def.name} has no subcommands: one line`);
    } else {
      assert.deepEqual(uses.map((u) => u.sub).sort(), [...subs].sort(), `${def.name}'s lines match its subcommands`);
    }
    for (const u of uses) {
      assert.ok(u.form.startsWith(`/${def.name}`), `${u.form} is a ${def.name} line`);
      if (u.sub) assert.ok(u.form.startsWith(`/${def.name} ${u.sub}`), `${u.form} names ${u.sub}`);
      assert.ok(u.help.length > 5);
    }
  }
});

test('a required option is written in angle brackets, an optional one in square brackets', () => {
  const required = (cmd: string, sub: string | null) => {
    const def = COMMAND_DEFINITIONS.find((c) => c.name === cmd)!;
    const opts = (sub ? (def.options as readonly { name: string; options?: readonly { name: string; required?: boolean }[] }[]).find((o) => o.name === sub)?.options : def.options) as readonly { name: string; required?: boolean; type?: number }[] | undefined;
    return (opts ?? []).filter((o) => o.required === true).map((o) => o.name);
  };
  for (const [cmd, uses] of Object.entries(COMMAND_USES)) {
    for (const u of uses) {
      for (const name of required(cmd, u.sub)) assert.ok(u.form.includes(`<${name}>`), `${u.form} shows <${name}> as needed`);
    }
  }
});

test('stored switches only ever name real commands', () => {
  assert.deepEqual([...parseCommandsOff(JSON.stringify(['coffer', 'nope', 3]))], ['coffer']);
  assert.deepEqual([...parseCommandsOff('not json')], []);
});
