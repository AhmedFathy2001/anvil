// Runs every `test:*` script in package.json, in sequence, and reports one summary.
//
// DISCOVERED, not listed. The repo has no test runner — each suite is a hand-written `test:*` script
// over node:test — and for a long time there was no aggregate at all, so CI ran two of them and four
// test files (board-misconfig, draft-control, event-stage, weekly-stage) were reachable by no script
// whatsoever and had never run in CI. Enumerating scripts here by hand would just re-create that
// drift, so this reads package.json instead: add a `test:*` script and it is covered automatically.
//
// Keeps going after a failure rather than stopping at the first, so one run tells you everything
// that is broken. Exits non-zero if any suite failed.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));

const suites = Object.keys(pkg.scripts ?? {})
  .filter((name) => name.startsWith('test:'))
  .sort();

if (suites.length === 0) {
  console.error('No test:* scripts found in package.json.');
  process.exit(1);
}

console.log(`Running ${suites.length} test suites\n`);

const failed = [];
for (const name of suites) {
  process.stdout.write(`── ${name} `.padEnd(40, '─') + '\n');
  const res = spawnSync('npm', ['run', '--silent', name], {
    cwd: root,
    stdio: 'inherit',
    // npm is a shell script on Windows; harmless elsewhere.
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) failed.push(name);
}

console.log('\n' + '='.repeat(40));
console.log(`${suites.length - failed.length}/${suites.length} suites passed`);
if (failed.length) {
  console.log('FAILED:');
  for (const name of failed) console.log(`  - ${name}`);
  process.exit(1);
}
