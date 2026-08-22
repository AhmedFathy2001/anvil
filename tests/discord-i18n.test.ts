import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { en } from '../src/lib/discordI18n/en.ts';

// Translation coverage for what the Discord bot says.
//
// Same contract as the /guide dictionaries: a missing key falls back to English at read time, so
// this does not demand completeness. What it catches is what the fallback hides —
//
//   1. A key present in a locale and NOT in English: a typo or a half-applied rename. The string is
//      dead and nothing at runtime will ever say so.
//   2. A placeholder that English has and a translation dropped. `{when}`, `{amount}`, `{n}` are the
//      whole sentence in some of these lines; a translation missing one renders "Starts ." and
//      reads as a bug in the bot rather than in a string table.
//   3. A description Discord would reject at registration. Discord caps command and option
//      descriptions at 100 characters and refuses the WHOLE registration if one is over — a silent,
//      total failure of the bot for the sake of one long sentence.
//
// Imports en.ts directly (explicit extension, Node type-stripping) rather than through the index,
// which uses extensionless imports the bundler resolves and Node does not.

const HERE = dirname(fileURLToPath(import.meta.url));
const I18N = join(HERE, '../src/lib/discordI18n');

/** Every string in a dictionary, as dotted paths → so two shapes can be compared. */
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      for (const [k, v] of leaves(value, prefix ? `${prefix}.${key}` : key)) out.set(k, v);
    }
  }
  return out;
}

/** `{name}` placeholders in a string, as a set — order and repetition don't matter. */
function vars(s: string): Set<string> {
  return new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
}

const english = leaves(en);

const localeFiles = readdirSync(I18N)
  .filter((f) => f.endsWith('.ts') && !['en.ts', 'index.ts'].includes(f))
  .sort();

test('there are locale files to check at all', () => {
  assert.ok(localeFiles.length > 0, 'no locale files found — did the directory move?');
});

for (const file of localeFiles) {
  const code = file.replace(/\.ts$/, '');

  test(`${code}: every key exists in English, and every placeholder survives translation`, async () => {
    const mod = await import(join(I18N, file));
    const dict = leaves(mod.default);

    for (const key of dict.keys()) {
      assert.ok(
        english.has(key),
        `${code}.ts has "${key}", which English does not. Rename or delete it — nothing reads it.`,
      );
    }

    for (const [key, translated] of dict) {
      const wanted = vars(english.get(key)!);
      const got = vars(translated);
      for (const name of wanted) {
        assert.ok(
          got.has(name),
          `${code}.ts "${key}" drops {${name}} — the value it carries would vanish from the message.`,
        );
      }
      for (const name of got) {
        assert.ok(
          wanted.has(name),
          `${code}.ts "${key}" adds {${name}}, which nothing supplies — it renders literally.`,
        );
      }
    }
  });

  test(`${code}: command descriptions fit what Discord accepts`, async () => {
    // Over 100 characters and Discord rejects the entire PUT, taking every command with it.
    const mod = await import(join(I18N, file));
    const dict = leaves(mod.default);
    for (const [key, value] of dict) {
      if (key !== 'help.command' && !key.startsWith('help.subs.') && key !== 'help.optionTeamName') continue;
      assert.ok(value.length <= 100, `${code}.ts "${key}" is ${value.length} chars; Discord caps it at 100`);
    }
  });
}

test('coverage, per locale', async () => {
  const rows: string[] = [];
  for (const file of localeFiles) {
    const mod = await import(join(I18N, file));
    const dict = leaves(mod.default);
    const covered = [...english.keys()].filter((k) => dict.has(k)).length;
    const pct = Math.round((covered / english.size) * 100);
    rows.push(`  ${file.replace(/\.ts$/, '').padEnd(8)}: ${covered}/${english.size} strings (${pct}%)`);
  }
  for (const row of rows.sort()) console.log(row);
});

test('every locale the registry advertises has a file behind it', () => {
  // The registry is read as source: index.ts uses extensionless imports Node cannot resolve, and a
  // row pointing at a file that isn't there is a command that throws the first time someone in that
  // language runs it.
  const source = readFileSync(join(I18N, 'index.ts'), 'utf8');
  const registered = [...source.matchAll(/\{\s*code: '([^']+)'/g)].map((m) => m[1]);
  assert.ok(registered.includes('en'), 'English must be registered');
  const present = new Set([...localeFiles.map((f) => f.replace(/\.ts$/, '')), 'en']);
  for (const code of registered) {
    assert.ok(present.has(code), `index.ts registers "${code}" but ${code}.ts does not exist`);
  }
  for (const code of present) {
    assert.ok(registered.includes(code), `${code}.ts exists but index.ts never registers it`);
  }
});
