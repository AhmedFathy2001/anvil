import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { en } from '../src/app/guide/_i18n/en.ts';

// Translation coverage for the /guide pages.
//
// Missing keys are fine by design — they fall back to English at read time — so this does not
// demand completeness. What it does catch is the two failures that fallback HIDES:
//
//   1. A key that exists in a locale and NOT in English. That is a typo, or a rename that only got
//      applied to one side; either way the string is dead and nothing at runtime will ever say so.
//   2. A locale advertised as `complete: true` in the registry that isn't. Readers are told the page
//      is fully translated, and the fallback makes the lie invisible.
//
// It also prints per-locale coverage, which is the number you want when deciding whether a language
// is ready to move from `complete: false` to `complete: true`.
//
// Imports en.ts directly (explicit extension, Node type-stripping) rather than through _i18n/index,
// which uses extensionless imports the bundler resolves and Node does not.

const HERE = dirname(fileURLToPath(import.meta.url));
const I18N = join(HERE, '../src/app/guide/_i18n');

/** Every translatable string in a dictionary, as dotted paths → so two shapes can be compared. */
function leaves(node: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === 'string') {
    out.set(prefix, node);
    return out;
  }
  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      for (const [k, v] of leaves(item, `${prefix}[${i}]`)) out.set(k, v);
    });
    return out;
  }
  if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      for (const [k, v] of leaves(value, prefix ? `${prefix}.${key}` : key)) out.set(k, v);
    }
  }
  return out;
}

const localeFiles = readdirSync(I18N)
  .filter((f) => f.endsWith('.ts') && !['en.ts', 'index.ts'].includes(f))
  .sort();

/** The registry's own claims, read as text — index.ts can't be imported here (see above). */
const registry = readFileSync(join(I18N, 'index.ts'), 'utf8');
const claimsComplete = (code: string) =>
  new RegExp(`code: '${code}',[^}]*complete: true`).test(registry);

// Two views of English, because an empty string means something specific here. An empty value is an
// override SLOT: the page falls back to the app's own label (event formats, tile kinds) when a
// locale leaves it blank. Filling one is legal, skipping it is legal, so it belongs in the set of
// keys a locale MAY use but not in the denominator of what it must translate.
const englishKeys = leaves(en);
const english = new Map([...englishKeys].filter(([, value]) => value !== ''));

test('English has strings to translate', () => {
  assert.ok(english.size > 200, `expected a populated dictionary, got ${english.size} strings`);
});

for (const file of localeFiles) {
  const code = file.replace(/\.ts$/, '');

  test(`${code}: every key exists in English`, async () => {
    const mod = await import(join(I18N, file));
    const translated = leaves(mod.default);

    // Array entries are compared by index, so a locale that supplies a DIFFERENT number of rows in a
    // table shows up here too — which is the intended reading: the table's shape is English's to set.
    const orphans = [...translated.keys()].filter((k) => !englishKeys.has(k));
    assert.deepEqual(orphans, [], `keys not present in en.ts (typo or stale rename):\n  ${orphans.join('\n  ')}`);

    const covered = [...english.keys()].filter((k) => translated.has(k)).length;
    const pct = Math.round((covered / english.size) * 100);
    console.log(`  ${code}: ${covered}/${english.size} strings (${pct}%)`);

    if (claimsComplete(code)) {
      const missing = [...english.keys()].filter((k) => !translated.has(k));
      assert.deepEqual(
        missing,
        [],
        `${code} is registered as complete: true but is missing ${missing.length} strings:\n  ${missing.slice(0, 20).join('\n  ')}`,
      );
    }
  });
}
