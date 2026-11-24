// The guides redesign against a real database: the seed migration's shape, and the community store
// (submit, vote with kc, report, review, tips, wanted, follows, skips, item snapshots, post
// selections kept across a resync).
//
// Run: TESTS_OK=1 npx tsx --test tests/guides-redesign-db.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('guides-redesign');
let pool: Pool;

before(async () => {
  await resetDatabase(DB);
  pool = (await loadDb()).pool;
});
after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const now = () => new Date().toISOString();

async function user(name: string, extra: Record<string, unknown> = {}): Promise<{ userId: number; playerId: number; accountId: number }> {
  const p = await pool.query(`INSERT INTO players (display_name) VALUES ($1) RETURNING id`, [name]);
  const playerId = p.rows[0].id as number;
  const u = await pool.query(
    `INSERT INTO users (discord_id, display_name, player_id, platform_role, platform_guide_editor) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [`d${name}${Math.floor(Math.random() * 1e9)}`, name, playerId, extra.platformRole ?? 'none', extra.editor ?? false],
  );
  const a = await pool.query(`INSERT INTO accounts (rsn, rsn_normalized, player_id, is_primary) VALUES ($1, $2, $3, 1) RETURNING id`, [name, name.toLowerCase(), playerId]);
  return { userId: u.rows[0].id, playerId, accountId: a.rows[0].id };
}

test('seeds: Vorkath has setup pills per level with ids, fallbacks and spells', async () => {
  const { parseGearBlock, splitSegments } = await import('../src/lib/guideTiers.ts');
  const { rows } = await pool.query(`SELECT body, version FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  assert.equal(rows.length, 1);
  const seg = splitSegments(rows[0].body).find((s) => s.kind === 'gear')!;
  const block = parseGearBlock(seg.text)!;
  assert.deepEqual(block.setups.map((s) => s.id), ['beginner-rcb', 'intermediate-dhcb', 'intermediate-dhl', 'intermediate-budget-rcb', 'advanced-tbow', 'advanced-dhcb-masori']);
  const dhcb = block.setups[1];
  assert.equal(dhcb.quiver, 21946);
  assert.deepEqual(dhcb.alts?.cape, [22109, 10499]);
  assert.deepEqual(dhcb.spells, ['Crumble Undead', 'Teleport to House']);
  assert.equal(rows[0].version, 4);
});

test('seeds: other library gear blocks got stable ids that match the derived keys', async () => {
  const { parseGearBlock, splitSegments } = await import('../src/lib/guideTiers.ts');
  const { setupKey } = await import('../src/lib/guideSetups.ts');
  const { rows } = await pool.query(`SELECT slug, body FROM guides WHERE clan_id IS NULL AND body LIKE '%\`\`\`gear%' AND slug <> 'vorkath-guide'`);
  assert.ok(rows.length >= 3);
  for (const r of rows) {
    const block = parseGearBlock(splitSegments(r.body).find((s) => s.kind === 'gear')!.text)!;
    assert.ok(block, r.slug);
    block.setups.forEach((s, i) => assert.equal(s.id, setupKey({ tier: s.tier, name: s.name }, i), `${r.slug} ${s.name}`));
  }
});

test('seeds: the Ironman route parses, with quest steps and forks', async () => {
  const { splitSegments } = await import('../src/lib/guideTiers.ts');
  const { parseRouteBlock } = await import('../src/lib/guideRoutes.ts');
  const { rows } = await pool.query(`SELECT body, kind, category FROM guides WHERE slug = 'ironman-first-100-hours'`);
  assert.equal(rows[0].kind, 'route');
  assert.equal(rows[0].category, 'routes');
  const route = parseRouteBlock(splitSegments(rows[0].body).find((s) => s.kind === 'route')!.text)!;
  const steps = route.chapters.flatMap((c) => c.steps);
  assert.ok(steps.length >= 15 && steps.length <= 25, `${steps.length} steps`);
  assert.ok(steps.some((s) => s.goal.kind === 'quest'));
  assert.ok(steps.some((s) => s.forks?.hcim?.skip));
});

test('community: submit, kc-gated votes, own clan weighted down, report, promote', async () => {
  const store = await import('../src/lib/guideCommunity.ts');
  const author = await user('Author1');
  const voter = await user('Voter1');
  const nokc = await user('NoKc1');
  const { rows } = await pool.query(`SELECT id FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  const guideId = rows[0].id as number;
  const c = await store.submitSetup({ guideId, userId: author.userId, tier: 'intermediate', setup: { name: 'Budget DHL', gear: { weapon: 22978 }, inventory: [], accounts: ['main'], builds: ['main'] }, notes: 'Cheap' });
  assert.equal(c.status, 'live');
  await pool.query(`INSERT INTO account_stat_snapshots (account_id, snapshot) VALUES ($1, $2)`, [voter.accountId, JSON.stringify({ skills: {}, bosses: { vorkath: { score: 120, rank: 1 } } })]);
  const v1 = await store.voteUsed({ guideId, setupKey: `c${c.id}`, userId: voter.userId });
  assert.equal(v1.ok, true, JSON.stringify(v1));
  const v2 = await store.voteUsed({ guideId, setupKey: `c${c.id}`, userId: nokc.userId });
  assert.equal(v2.ok, false, 'no kc on the boss, no vote');
  const again = await store.voteUsed({ guideId, setupKey: `c${c.id}`, userId: voter.userId });
  assert.equal(again.ok, true);
  const { rows: votes } = await pool.query(`SELECT count(*)::int AS n FROM guide_setup_votes WHERE setup_key = $1`, [`c${c.id}`]);
  assert.equal(votes[0].n, 1, 'one vote per account');

  await store.reportContribution(c.id, nokc.userId, 'Wrong gear');
  const q = await store.curatorQueue('reported');
  assert.ok(q.some((x) => x.id === c.id));

  const staff = await user('Staff1', { platformRole: 'staff' });
  const res = await store.reviewContribution({ id: c.id, action: 'promote', userId: staff.userId, tag: 'substantive' });
  assert.equal(res.ok, true, JSON.stringify(res));
  const { rows: g } = await pool.query(`SELECT body FROM guides WHERE id = $1`, [guideId]);
  assert.match(g[0].body, new RegExp(`"communityId":${c.id}`));
});

test('item snapshots are owner-only and deleted on opt-out; skips and the budget cap store', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const me = await user('Owner1');
  const other = await user('Other1');
  await items.saveSnapshot(me.accountId, { bank: { items: [{ id: 21012 }], readAt: now() }, equipment: { items: [{ id: 28951 }], readAt: now() } });
  const mine = await items.snapshotForViewer(me.userId, me.accountId);
  assert.equal(mine?.bank?.items[0].id, 21012);
  assert.equal(await items.snapshotForViewer(other.userId, me.accountId), null, 'nobody else reads it');
  await items.deleteSnapshot(me.accountId);
  assert.equal(await items.snapshotForViewer(me.userId, me.accountId), null);

  await items.setSkip(me.accountId, 21012, 'cant_afford');
  await items.setBudgetCap(me.accountId, 50_000_000);
  const prefs = await items.prefsForAccount(me.accountId);
  assert.deepEqual([...prefs.skipped.keys()], [21012]);
  assert.equal(prefs.budgetCap, 50_000_000);
  await items.clearSkip(me.accountId, 21012);
  assert.equal((await items.prefsForAccount(me.accountId)).skipped.size, 0);
});

test('a post selection survives a resync: stored, read back, and new setups stay out', async () => {
  const { cleanSelection, selectAll } = await import('../src/lib/guideSelection.ts');
  const { parseGearBlock, splitSegments } = await import('../src/lib/guideTiers.ts');
  const { rows } = await pool.query(`SELECT id, body FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  const block = parseGearBlock(splitSegments(rows[0].body).find((s) => s.kind === 'gear')!.text)!;
  const clan = await pool.query(`INSERT INTO clans (slug, name, created_at) VALUES ('selclan', 'Sel', $1) RETURNING id`, [now()]);
  const sel = { ...selectAll(block), setups: ['intermediate-dhcb'] };
  await pool.query(
    `INSERT INTO guide_posts (clan_id, guide_id, channel_id, message_ids, selection, created_at, updated_at) VALUES ($1, $2, 'c1', '["m1"]', $3, $4, $4)`,
    [clan.rows[0].id, rows[0].id, JSON.stringify(sel), now()],
  );
  const { rows: posts } = await pool.query(`SELECT selection FROM guide_posts WHERE clan_id = $1`, [clan.rows[0].id]);
  const back = cleanSelection(posts[0].selection)!;
  assert.deepEqual(back.setups, ['intermediate-dhcb']);
  const { postSelectionBody } = await import('../src/lib/guidePosting.ts');
  const grown = rows[0].body.replace('"setups":[', '"setups":[{"id":"late-add","tier":"intermediate","name":"Late add","style":1,"stats":{"attack":1,"strength":1,"ranged":1,"magic":1},"gear":{"weapon":9185}},');
  const { indexGear } = await import('../src/lib/dps/summary.ts');
  const { GEAR_DATA } = await import('../src/lib/dps/data.ts');
  const body = postSelectionBody(grown, back, indexGear(GEAR_DATA), null, 'Vorkath');
  assert.equal(body.includes('Late add'), false);
  assert.match(body, /Ranged · DHCB/);
});
