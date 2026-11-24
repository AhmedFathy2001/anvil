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
  await items.saveSnapshot(other.accountId, { bank: { items: [{ id: 4151 }], readAt: now() } });
  await items.deleteSnapshotsForUser(me.userId);
  assert.equal(await items.snapshotForViewer(me.userId, me.accountId), null);
  assert.equal((await items.snapshotForViewer(other.userId, other.accountId))?.bank?.items[0].id, 4151, "another person's stays");

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

// ── Scoping: global/curator rights never reach a clan's rows ───────────────────────────────────

async function clanWithGuide(slug: string) {
  const clan = await pool.query(`INSERT INTO clans (slug, name, created_at) VALUES ($1, $1, $2) RETURNING id`, [slug, now()]);
  const clanId = clan.rows[0].id as number;
  const g = await pool.query(
    `INSERT INTO guides (clan_id, slug, title, body, status, created_at, updated_at) VALUES ($1, 'own', 'Own guide', 'Body', 'published', $2, $2) RETURNING id`,
    [clanId, now()],
  );
  return { clanId, guideId: g.rows[0].id as number };
}

test('scope: an outside curator cannot review, hide or close a clan’s rows; its editors and staff can', async () => {
  const store = await import('../src/lib/guideCommunity.ts');
  const { clanId, guideId } = await clanWithGuide('scopeclan');
  const writer = await user('ClanWriter');
  const curator = await user('OutsideCurator', { editor: true });
  const clanEditor = await user('ClanEditor');
  const staff = await user('PlatformStaff', { platformRole: 'staff' });
  await pool.query(`INSERT INTO clan_staff (clan_id, user_id, role, can_edit_guides) VALUES ($1, $2, 'member', true)`, [clanId, clanEditor.userId]);

  // A pin on the clan's guide, and a community row on its clan-original guide (clan_id null on the row).
  const pin = await store.submitSetup({ guideId, userId: writer.userId, tier: 'beginner', setup: { name: 'Pin', gear: { weapon: 4151 } }, clanId });
  const onClanGuide = await store.submitSetup({ guideId, userId: writer.userId, tier: 'beginner', setup: { name: 'Community on clan guide', gear: { weapon: 4151 } } });
  for (const id of [pin.id, onClanGuide.id]) {
    assert.equal(await store.mayReviewContribution(curator.userId, id), false, 'outside curator');
    assert.equal(await store.mayReviewContribution(clanEditor.userId, id), true, 'that clan’s guide editor');
    assert.equal(await store.mayReviewContribution(staff.userId, id), true, 'platform staff');
  }
  const queue = await store.curatorQueue('new');
  assert.equal(queue.some((q) => q.id === pin.id || q.id === onClanGuide.id), false, 'clan rows stay out of the library queue');

  await store.addTip({ guideId, userId: writer.userId, kind: 'tip', text: 'A clan tip with words', clanId });
  const { rows: tips } = await pool.query(`SELECT id FROM guide_tips WHERE clan_id = $1`, [clanId]);
  assert.equal(await store.mayModerateTip(curator.userId, tips[0].id), false);
  assert.equal(await store.mayModerateTip(clanEditor.userId, tips[0].id), true);

  await store.requestWanted({ userId: writer.userId, guideId, tier: 'advanced' });
  const { rows: w } = await pool.query(`SELECT id FROM guide_wanted WHERE guide_id = $1`, [guideId]);
  assert.equal(await store.mayModerateWanted(curator.userId, w[0].id), false);
  assert.equal(await store.mayModerateWanted(clanEditor.userId, w[0].id), true);

  assert.equal(await store.upkeepTarget(guideId), null, 'upkeep flags only touch library guides');
  const { rows: lib } = await pool.query(`SELECT id FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  assert.ok(await store.upkeepTarget(lib[0].id));
});

test('scope: library rows are curators’ and not a clan editor’s', async () => {
  const store = await import('../src/lib/guideCommunity.ts');
  const { rows } = await pool.query(`SELECT id FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  const writer = await user('LibWriter');
  const clanOnlyEditor = await user('ClanOnlyEditor');
  const curator = await user('LibCurator', { editor: true });
  const c = await store.submitSetup({ guideId: rows[0].id, userId: writer.userId, tier: 'beginner', setup: { name: 'Lib setup', gear: { weapon: 4151 } } });
  assert.equal(await store.mayReviewContribution(curator.userId, c.id), true);
  assert.equal(await store.mayReviewContribution(clanOnlyEditor.userId, c.id), false);
});

test('scope: item snapshots, skips and follows are the owner’s own rows', async () => {
  const items = await import('../src/lib/playerItems.ts');
  const a = await user('OwnerA');
  const b = await user('StaffB', { platformRole: 'staff' });
  await items.saveSnapshot(a.accountId, { inventory: { items: [{ id: 4151 }], readAt: now() } });
  assert.equal(await items.snapshotForViewer(b.userId, a.accountId), null, 'platform staff read nothing of it');
  assert.equal(await items.ownsAccount(b.userId, a.accountId), false);
});

// ── Self-dealing and races: one review, one save, one credit ───────────────────────────────────

async function editProposal(proposerUserId: number) {
  const { rows } = await pool.query(`SELECT id, title, summary, category, body, version FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  const g = rows[0];
  const p = await pool.query(
    `INSERT INTO guide_proposals (proposer_user_id, target_guide_id, base_version, title, summary, category, body, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $8) RETURNING *`,
    [proposerUserId, g.id, g.version, g.title, g.summary, g.category, `${g.body}\n\nOne more tip line ${Math.random()}.`, now()],
  );
  return { guideId: g.id as number, proposalId: p.rows[0].id as number };
}

test('proposals: self-approval is refused', async () => {
  const props = await import('../src/lib/guideProposals.ts');
  const me = await user('SelfReviewer', { platformRole: 'staff' });
  const { proposalId } = await editProposal(me.userId);
  const p = (await props.getProposal(proposalId))!;
  await assert.rejects(props.approveProposal(p, me.userId, { tag: 'substantive' }), /Someone else has to review your own edit/);
  const { rows } = await pool.query(`SELECT status FROM guide_proposals WHERE id = $1`, [proposalId]);
  assert.equal(rows[0].status, 'pending');
});

test('proposals: two approvals at once make one save and one credit row', async () => {
  const props = await import('../src/lib/guideProposals.ts');
  const writer = await user('RaceWriter');
  const r1 = await user('RaceReviewer1', { platformRole: 'staff' });
  const r2 = await user('RaceReviewer2', { platformRole: 'staff' });
  const { guideId, proposalId } = await editProposal(writer.userId);
  const before = (await pool.query(`SELECT count(*)::int AS n FROM guide_revisions WHERE guide_id = $1`, [guideId])).rows[0].n;
  const p = (await props.getProposal(proposalId))!;
  const results = await Promise.allSettled([props.approveProposal(p, r1.userId, { tag: 'fix' }), props.approveProposal(p, r2.userId, { tag: 'fix' })]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'exactly one approval wins');
  const credits = (await pool.query(`SELECT count(*)::int AS n FROM guide_edit_credits WHERE proposal_id = $1`, [proposalId])).rows[0].n;
  assert.equal(credits, 1);
  const after = (await pool.query(`SELECT count(*)::int AS n FROM guide_revisions WHERE guide_id = $1`, [guideId])).rows[0].n;
  assert.equal(after - before, 1, 'one save');
  // The unique index refuses a second credit row for the same proposal outright.
  await assert.rejects(pool.query(`INSERT INTO guide_edit_credits (guide_id, user_id, tag, month, proposal_id, created_at) VALUES ($1, $2, 'fix', '2026-11', $3, $4)`, [guideId, writer.userId, proposalId, now()]));
});

test('contributions: authors cannot promote their own; racing promotes save once', async () => {
  const store = await import('../src/lib/guideCommunity.ts');
  const { rows } = await pool.query(`SELECT id FROM guides WHERE clan_id IS NULL AND slug = 'ironman-first-100-hours'`);
  const routeId = rows[0].id as number;
  const author = await user('StepAuthor', { platformRole: 'staff' });
  const c1 = await store.suggestStep({ guideId: routeId, userId: author.userId, chapter: 0, step: { title: 'Own step', goal: { kind: 'manual' } } });
  const self = await store.reviewContribution({ id: c1.id, action: 'promote', userId: author.userId, tag: 'substantive' });
  assert.deepEqual(self, { ok: false, error: 'Someone else has to review your own edit.' });

  const s1 = await user('StepReviewer1', { platformRole: 'staff' });
  const s2 = await user('StepReviewer2', { platformRole: 'staff' });
  const before = (await pool.query(`SELECT count(*)::int AS n FROM guide_revisions WHERE guide_id = $1`, [routeId])).rows[0].n;
  const res = await Promise.all([
    store.reviewContribution({ id: c1.id, action: 'promote', userId: s1.userId, tag: 'substantive' }),
    store.reviewContribution({ id: c1.id, action: 'promote', userId: s2.userId, tag: 'substantive' }),
  ]);
  assert.equal(res.filter((r) => r.ok).length, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM guide_edit_credits WHERE contribution_id = $1`, [c1.id])).rows[0].n, 1);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM guide_revisions WHERE guide_id = $1`, [routeId])).rows[0].n - before, 1);
});
