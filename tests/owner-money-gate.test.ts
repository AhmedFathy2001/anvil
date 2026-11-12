// The root gate on /staff/money and /staff/analytics: every route, the page and the nav are platform
// root only. Source checks (as the other staff gate tests do) plus a check that root, and not
// users.is_owner (a clan owner's flag), decides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
}

test('every money route guards every handler with requireOwnerApi, and none with a platform role alone', () => {
  const routes = walk('src/app/api/staff/money').filter((f) => f.endsWith('route.ts'));
  assert.ok(routes.length >= 5);
  for (const f of routes) {
    const src = readFileSync(f, 'utf8');
    const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)];
    assert.ok(handlers.length > 0, f);
    const gates = [...src.matchAll(/await requireOwnerApi\(\)/g)].length;
    assert.equal(gates, handlers.length, `${f}: one owner gate per handler`);
    assert.ok(!/requirePlatformApi/.test(src), `${f}: a platform role must not be the gate`);
    assert.match(src, /'response' in gate/);
  }
});

test('the pages 404 for anyone but root, and the nav links are drawn only for root', () => {
  const page = readFileSync('src/app/staff/money/page.tsx', 'utf8');
  assert.match(page, /requireOwnerPage\(\)/);
  assert.match(page, /if \(!actor\) notFound\(\)/);
  const layout = readFileSync('src/app/staff/layout.tsx', 'utf8');
  assert.match(layout, /isRoot \? \[\{ href: '\/staff\/money'/);
  assert.match(layout, /isRoot \? \[\{ href: '\/staff\/analytics'/);
  assert.match(readFileSync('src/app/staff/analytics/page.tsx', 'utf8'), /requireOwnerPage\(\)/);
  const sidebarLinks = layout.match(/\/staff\/money/g) ?? [];
  assert.equal(sidebarLinks.length, 1, 'only one place renders the link');
});

test('the guard is platform root: the clan owner flag alone gets nothing', () => {
  const guard = readFileSync('src/lib/ownerAccess.ts', 'utf8');
  assert.match(guard, /platformActor\('root'\)/);
  assert.ok(!/isOwner|is_owner/.test(guard.replace(/\/\/.*$/gm, '')), 'no owner flag in the guard');
  assert.match(guard, /NextResponse\.json\(\{ error: 'Not found' \}, \{ status: 404 \}\)/);
});

test('no amount or buyer email is reachable outside the owner surface', () => {
  const users = ['src/lib/money.ts', 'src/lib/ownerTrials.ts', 'src/lib/moneyRules.ts'];
  const hits: string[] = [];
  for (const f of walk('src').filter((x) => /\.(ts|tsx)$/.test(x))) {
    if (f.startsWith('src/app/staff/money') || f.startsWith('src/app/api/staff/money') || users.includes(f) || f === 'src/lib/moneyLedger.ts' || f === 'src/lib/moneyLedgerRules.ts') continue;
    const src = readFileSync(f, 'utf8');
    if (/from '@\/lib\/(money|ownerTrials)'/.test(src) || /billingLedger/.test(src) && f !== 'src/db/schema.ts') hits.push(f);
  }
  assert.deepEqual(hits, [], 'only the money surface imports the money readers');
});
