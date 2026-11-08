// The owner gate on /staff/money: every route, the page and the nav are owner-only. Source checks
// (as the other staff gate tests do) plus a real-database check that the flag, not a platform role,
// decides. Needs the test Postgres for the second half.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('owner-money-gate');
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];

before(async () => { await resetDatabase(DB); ({ pool } = await loadDb()); });
after(async () => { await pool.end(); await dropDatabase(DB); });

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

test('the page 404s for anyone but the owner, and the nav link is drawn only for them', () => {
  const page = readFileSync('src/app/staff/money/page.tsx', 'utf8');
  assert.match(page, /requireOwnerPage\(\)/);
  assert.match(page, /if \(!actor\) notFound\(\)/);
  const layout = readFileSync('src/app/staff/layout.tsx', 'utf8');
  assert.match(layout, /isOwner \? \[\{ href: '\/staff\/money'/);
  const sidebarLinks = layout.match(/\/staff\/money/g) ?? [];
  assert.equal(sidebarLinks.length, 1, 'only one place renders the link');
});

test('the guard reads users.is_owner live and refuses root, staff and support alike', async () => {
  const { db, schema: s } = await loadDb();
  const A = await import('../src/lib/ownerAccess.ts');
  const mk = async (name: string, platformRole: string, isOwner: boolean) =>
    (await db.insert(s.users).values({ displayName: name, discordId: `d-${name}`, platformRole, isOwner } as never).returning())[0].id;
  const owner = await mk('owner', 'root', true);
  const root = await mk('root', 'root', false);
  const staff = await mk('staff', 'staff', false);
  const support = await mk('support', 'support', false);
  assert.equal(await A.isPlatformOwner(owner), true);
  for (const id of [root, staff, support]) assert.equal(await A.isPlatformOwner(id), false);
  assert.equal(await A.isPlatformOwner(99999), false);
  const guard = readFileSync('src/lib/ownerAccess.ts', 'utf8');
  assert.match(guard, /platformActor\('support'\)/);
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
