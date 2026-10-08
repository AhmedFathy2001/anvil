// The slash-command guide (/guide/commands) is generated from the registered commands, but its
// examples and tips are written by hand. These tests make sure the two stay paired: every command a
// member can type has an example, no example describes a command that no longer exists, and the
// examples only use options the command actually has.
//
// Run: npm run test:commandguide

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { guideCommands } from '../src/lib/discordCommandGuide.ts';
import { COMMAND_NAMES } from '../src/lib/discordCommandDefs.ts';
import { en } from '../src/app/guide/_i18n/en.ts';

const commands = guideCommands();

test('every registered command is in the guide', () => {
  const roots = new Set(commands.map((c) => c.root));
  for (const name of COMMAND_NAMES) assert.ok(roots.has(name), `/${name} missing from the guide`);
});

test('every command has an example, and no example is stale', () => {
  const paths = new Set(commands.map((c) => c.path));
  const examples = en.commands.examples;
  for (const p of paths) {
    assert.ok(examples[p]?.examples?.length, `no example for /${p}`);
    assert.ok(examples[p].tip, `no tip for /${p}`);
  }
  for (const key of Object.keys(examples)) assert.ok(paths.has(key), `example for /${key}, which is not a command`);
});

test('examples only use the command’s own options, and include every required one', () => {
  for (const cmd of commands) {
    const names = new Set(cmd.options.map((o) => o.name));
    for (const ex of en.commands.examples[cmd.path].examples) {
      assert.ok(ex.startsWith(`/${cmd.path}`), `"${ex}" is not /${cmd.path}`);
      const used = [...ex.matchAll(/(?:^|\s)([a-z_]+):/g)].map((m) => m[1]);
      for (const u of used) assert.ok(names.has(u), `"${ex}" uses ${u}:, which /${cmd.path} doesn't have`);
      for (const o of cmd.options.filter((x) => x.required)) {
        assert.ok(used.includes(o.name), `"${ex}" leaves out required ${o.name}:`);
      }
    }
  }
});

test('usage lines read the way Discord shows them', () => {
  const byPath = new Map(commands.map((c) => [c.path, c]));
  assert.equal(byPath.get('coffer add')?.usage, '/coffer add <amount> [note]');
  assert.equal(byPath.get('bingo board')?.usage, '/bingo board');
  assert.equal(byPath.get('guide')?.usage, '/guide <topic> [step] [language]');
  const member = byPath.get('stats luck')!.options.find((o) => o.name === 'member')!;
  assert.equal(member.kind, 'member');
  assert.equal(byPath.get('stats pbs')!.options.find((o) => o.name === 'page')!.kind, 'search');
  const size = byPath.get('stats pbs')!.options.find((o) => o.name === 'size')!;
  assert.deepEqual([size.kind, size.min, size.max], ['number', 1, 100]);
  assert.equal(byPath.get('eff')!.options.find((o) => o.name === 'metric')!.kind, 'choice');
});

test('/guide topic:commands walks the same sections as the page, each with text to show', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/guide/_pages/CommandsGuide.tsx'), 'utf-8');
  const page = /COMMANDS_SECTIONS = \[([^\]]+)\]/.exec(src)![1].match(/'([a-z]+)'/g)!.map((s) => s.slice(1, -1));
  const outlineSrc = readFileSync(join(process.cwd(), 'src/lib/discordGuides.ts'), 'utf-8');
  const outline = /commands: \{ ns: 'commands', page: 'commands', sections: \[([^\]]+)\]/.exec(outlineSrc)![1]
    .match(/'([a-z]+)'/g)!
    .map((s) => s.slice(1, -1));
  assert.deepEqual(outline, page);
  const dict = en.commands as unknown as Record<string, { title?: string; body?: string[]; intro?: string }>;
  for (const id of page) {
    assert.ok(dict[id]?.title, `${id} has a title`);
    assert.ok(dict[id]?.body?.length || dict[id]?.intro, `${id} has text for Discord`);
  }
});
