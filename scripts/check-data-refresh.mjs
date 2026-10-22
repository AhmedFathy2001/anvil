// Gate for the scheduled wiki refresh (.github/workflows/refresh-game-data.yml), run after the
// data:* scripts have rewritten src/data.
//
// 1. Every builder stamps `generatedAt`, so a run against an unchanged wiki still rewrites each
//    file. A file whose only change is that stamp is put back, or the daily job would open a PR a
//    day for nothing.
// 2. A wiki outage or a schema change on their side comes back as a short or empty catalogue. The
//    game only ever adds content, so a catalogue that lost more than SHRINK_LIMIT of its entries
//    fails the run instead of reaching a PR.
//
// Run:  node scripts/check-data-refresh.mjs   (exit 1 = a catalogue shrank)

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const SHRINK_LIMIT = 0.05;

const changed = execFileSync('git', ['diff', '--name-only', '--', 'src/data'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f.endsWith('.json'));

// Leaf values (strings/numbers/booleans) in the tree — a size measure that works for every
// catalogue shape, flat id lists and nested tables alike.
function leaves(v) {
  if (Array.isArray(v)) return v.reduce((n, x) => n + leaves(x), 0);
  if (v && typeof v === 'object') return Object.values(v).reduce((n, x) => n + leaves(x), 0);
  return 1;
}

function withoutStamp(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return v;
  const { generatedAt: _stamp, ...rest } = v;
  return rest;
}

let failed = false;
for (const file of changed) {
  const oldText = execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
  const oldData = withoutStamp(JSON.parse(oldText));
  const newData = withoutStamp(JSON.parse(readFileSync(file, 'utf8')));

  if (JSON.stringify(oldData) === JSON.stringify(newData)) {
    writeFileSync(file, oldText);
    console.log(`${file}: only the timestamp moved — restored`);
    continue;
  }

  const before = leaves(oldData);
  const after = leaves(newData);
  const drop = before > 0 ? (before - after) / before : 0;
  console.log(`${file}: ${before} → ${after} values`);
  if (drop > SHRINK_LIMIT) {
    console.error(`  ${file} lost ${(drop * 100).toFixed(1)}% of its values — refusing (wiki outage or schema change?)`);
    failed = true;
  }
}

process.exit(failed ? 1 : 0);
