// verifyTileEditorForEvent and verifyEventTreasurer answer "may this person act on event N?" from
// their grants — they do NOT tie event N to the clan the request is addressed to. A route that
// calls one and nothing else would act on another clan's event by id. So every such route must
// ALSO call a clan-scoping guard (lib/eventScope). A source scan, because the failure is a missing
// line that review reads straight past.
//
// Pure: reads files, imports nothing from src.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API = join(import.meta.dirname, '..', 'src', 'app', 'api');

const GRANT_HELPERS = /\b(verifyTileEditorForEvent|verifyEventTreasurer)\s*\(/;
// The clan-scoping guards: each resolves the event (or fee / competition) only inside the clan the
// request is addressed to.
const SCOPE_GUARDS =
  /\b(eventForRequest|feeEventForRequest|competitionForRequest|eventInClan|competitionInClan|eventForPluginRequest|requireEventForPage|requireEventForParticipantPage|requireCompetitionForPage)\s*\(/;

function routes(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routes(p));
    else if (name === 'route.ts') out.push(p);
  }
  return out;
}

/** Source without comments, so a guard named in a comment does not count as called. */
function code(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

test('every route using an event-grant helper also scopes the event to the clan', () => {
  const offenders: string[] = [];
  let checked = 0;
  for (const file of routes(API)) {
    const src = code(file);
    if (!GRANT_HELPERS.test(src)) continue;
    checked++;
    if (!SCOPE_GUARDS.test(src)) offenders.push(file.slice(API.length + 1));
  }
  assert.ok(checked > 0, 'the scan found no callers at all — the helper names or the path moved');
  assert.deepEqual(offenders, [], `routes calling verifyTileEditorForEvent/verifyEventTreasurer without a clan-scoping guard:\n  ${offenders.join('\n  ')}`);
});
