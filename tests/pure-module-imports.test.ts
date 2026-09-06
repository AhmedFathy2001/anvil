// A test of pure logic must not need a database to run.
//
// Three times in one day a suite of pure functions failed to load because the module it imported
// reached for `@/db` at module scope, which throws without DATABASE_URL:
//
//   the luck board  — clogLuckBoard pulls in db; the whole clog-luck suite went to 0 passed
//   the sweep merge — statHistory pulls in db; the dedupe could not be tested at all
//   the coffer feed — discord pulls in db; the line builder could not be tested at all
//
// Each time it looked fine locally, because a shell that had been debugging had DATABASE_URL
// exported. Each time the fix was the same: split the pure half into its own module, which is a
// convention this codebase already had (lib/cofferMath exists so a page can render a balance
// without importing the database).
//
// So this walks what the tests actually import and fails when one of them reaches a database,
// naming the chain. Standing it up found two more the same day — the Discord guild guard and the
// snapshot deltas — both of which had been papered over by a DATABASE_URL hardcoded into their npm
// script, which is the trap wearing a hat: the suite passes in CI and fails for anyone who runs the
// file directly. It is the cheap version of the rule — no build step, no lint plugin, just the
// import graph the suites already depend on.
//
// Run: npm run test:pureimports

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LIB = 'src/lib';

/**
 * `import type` is erased before anything runs, so a type-only edge reaches no database however
 * deep it goes — lib/types pulls a type off statTracking and would otherwise drag the whole
 * hiscores → auth → db chain behind it, condemning suites that run perfectly well.
 */
function withoutTypeImports(source: string): string {
  return source.replace(/^\s*import\s+type\s[^;]*;/gm, '');
}

const importsDatabase = (source: string) => /from\s+'@\/db'/.test(withoutTypeImports(source));

/** Every `@/lib/x` and `../src/lib/x` this file imports FOR REAL, as bare module names. */
function libImportsOf(source: string): string[] {
  const out = new Set<string>();
  for (const m of withoutTypeImports(source).matchAll(
    /from\s+'(?:@\/lib\/|\.\.\/src\/lib\/)([\w./-]+)'/g,
  )) {
    out.add(m[1].replace(/\.ts$/, ''));
  }
  return [...out];
}

/** Follows lib → lib imports until it finds `@/db`, returning the chain that reaches it. */
function pathToDatabase(entry: string, seen = new Set<string>()): string[] | null {
  if (seen.has(entry)) return null;
  seen.add(entry);
  const file = join(LIB, `${entry}.ts`);
  if (!existsSync(file)) return null;
  const source = readFileSync(file, 'utf8');
  if (importsDatabase(source)) return [entry];
  for (const next of libImportsOf(source)) {
    const rest = pathToDatabase(next, seen);
    if (rest) return [entry, ...rest];
  }
  return null;
}

test('no test imports a lib module that reaches for the database', () => {
  const offenders: string[] = [];

  for (const file of readdirSync('tests').filter((f) => f.endsWith('.test.ts'))) {
    const source = readFileSync(join('tests', file), 'utf8');
    // Suites that deliberately use a database say so by importing the harness. They are exempt:
    // the rule is about pure logic, not about everything.
    if (source.includes('helpers/testDb')) continue;
    // A dynamic import is the OTHER sanctioned escape — it runs after a placeholder URL is set,
    // which is what the luck suite does. Only static imports are the trap.
    const statics = source.replace(/await\s+import\([^)]*\)/g, '');

    for (const mod of libImportsOf(statics)) {
      const chain = pathToDatabase(mod);
      if (chain) offenders.push(`${file} → ${chain.join(' → ')} → @/db`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    'These suites cannot run without DATABASE_URL. Split the pure half into its own module ' +
      '(lib/cofferMath and lib/cofferFeedText are the pattern), or import it dynamically after ' +
      `setting a placeholder URL:\n  ${offenders.join('\n  ')}`,
  );
});
