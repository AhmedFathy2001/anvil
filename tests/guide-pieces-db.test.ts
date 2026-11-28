// Guide pieces against a real database (lib/guidePieces/store, lib/guideAreas): who may write what,
// clan scoping that can't be spoofed, overrides resolving over Anvil's pieces with "Anvil updated
// this", history and revert, the converter, and guide_areas seeded with the trip check's regions.
//
// Run: TESTS_OK=1 npx tsx --test tests/guide-pieces-db.test.ts

import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';

import { dropDatabase, loadDb, resetDatabase, useTestDatabase } from './helpers/testDb.ts';

const DB = useTestDatabase('guide-pieces');
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

async function user(name: string, extra: { platformRole?: string; editor?: boolean } = {}): Promise<{ userId: number; playerId: number }> {
  const p = await pool.query(`INSERT INTO players (display_name) VALUES ($1) RETURNING id`, [name]);
  const playerId = p.rows[0].id as number;
  const u = await pool.query(`INSERT INTO users (discord_id, display_name, player_id, platform_role, platform_guide_editor) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
    `d${name}${Math.floor(Math.random() * 1e9)}`, name, playerId, extra.platformRole ?? 'none', extra.editor ?? false,
  ]);
  return { userId: u.rows[0].id, playerId };
}
async function clan(slug: string): Promise<number> {
  return (await pool.query(`INSERT INTO clans (slug, name, created_at) VALUES ($1, $1, $2) RETURNING id`, [slug, now()])).rows[0].id;
}
async function seat(clanId: number, userId: number, role: string, canEditGuides = false) {
  await pool.query(`INSERT INTO clan_staff (clan_id, user_id, role, can_edit_guides) VALUES ($1, $2, $3, $4)`, [clanId, userId, role, canEditGuides]);
}
async function libraryGuide(slug: string, status = 'published'): Promise<number> {
  return (await pool.query(`INSERT INTO guides (clan_id, slug, title, body, status, created_at, updated_at) VALUES (NULL, $1, $1, '', $2, $3, $3) RETURNING id`, [slug, status, now()])).rows[0].id;
}

test('guide_areas: seeded with the regions the trip check shipped with, read back identically', async () => {
  const { TRIP_REGIONS, TRIP_REGION_IDS } = await import('../src/lib/tripContent.ts');
  const areas = await import('../src/lib/guideAreas.ts');
  assert.deepEqual(await areas.tripRegions(), TRIP_REGIONS);
  assert.deepEqual(await areas.tripRegionIds(), TRIP_REGION_IDS);
  const { rows } = await pool.query(`SELECT a.content_key, g.slug FROM guide_areas a LEFT JOIN guides g ON g.id = a.guide_id WHERE a.content_key = 'vorkath'`);
  assert.equal(rows[0].slug, 'vorkath-guide', 'the library guide is linked by slug');
  // A change in the table is what the check uses (after the cache lets go).
  await pool.query(`UPDATE guide_areas SET label = 'the Ungael bank' WHERE region_id = 9023`);
  areas.invalidateGuideAreas();
  assert.equal((await areas.tripRegions())[9023].name, 'the Ungael bank');
  await pool.query(`UPDATE guide_areas SET label = 'Ungael' WHERE region_id = 9023`);
  areas.invalidateGuideAreas();
  // An emptied table falls back to the seed rather than switching the check off everywhere.
  await pool.query(`UPDATE guide_areas SET trip_check = false`);
  areas.invalidateGuideAreas();
  assert.deepEqual(await areas.tripRegions(), TRIP_REGIONS);
  await pool.query(`UPDATE guide_areas SET trip_check = true`);
  areas.invalidateGuideAreas();
});

test('authz: who gets an actor, and a forged or stale actor writes nothing', async () => {
  const store = await import('../src/lib/guidePieces/store.ts');
  const guideId = await libraryGuide('authz-guide');
  const nobody = await user('PNobody');
  const editor = await user('PEditor', { editor: true });
  const staff = await user('PStaff', { platformRole: 'staff' });
  const support = await user('PSupport', { platformRole: 'support' });
  assert.equal(await store.libraryPieceActorFor(nobody.userId), null);
  assert.equal(await store.libraryPieceActorFor(support.userId), null, 'support reads, never writes');
  assert.ok(await store.libraryPieceActorFor(staff.userId));
  const lib = (await store.libraryPieceActorFor(editor.userId))!;
  assert.ok(lib);

  // A look-alike object is not an actor.
  const forged = { scope: 'library', userId: editor.userId } as unknown as Parameters<typeof store.createAnvilPiece>[0];
  await assert.rejects(store.createAnvilPiece(forged, { guideId, kind: 'note', body: { text: 'x' } }), (e: { status?: number }) => e.status === 404);

  const c = await clan('authz-a');
  const member = await user('CMember');
  const flagged = await user('CFlagged');
  const admin = await user('CAdmin');
  const mod = await user('CMod');
  await seat(c, member.userId, 'member');
  await seat(c, flagged.userId, 'member', true);
  await seat(c, admin.userId, 'admin');
  await seat(c, mod.userId, 'moderator');
  assert.equal(await store.clanPieceActorFor(member.userId, c), null);
  assert.equal(await store.clanPieceActorFor(mod.userId, c), null, 'moderator without the flag');
  assert.equal(await store.clanPieceActorFor(editor.userId, c), null, 'the library flag is no clan authority');
  assert.ok(await store.clanPieceActorFor(flagged.userId, c));
  const adminActor = (await store.clanPieceActorFor(admin.userId, c))!;
  assert.ok(adminActor);

  // Demoted after the actor was minted: the next write is refused.
  const p = await store.createAnvilPiece(lib, { guideId, kind: 'note', body: { text: 'Anvil note' }, status: 'published' });
  await pool.query(`UPDATE clan_staff SET role = 'member' WHERE clan_id = $1 AND user_id = $2`, [c, admin.userId]);
  await assert.rejects(store.saveOverride(adminActor, p.id, { body: { text: 'ours' } }), (e: { status?: number }) => e.status === 403);
  await pool.query(`UPDATE users SET platform_guide_editor = false WHERE id = $1`, [editor.userId]);
  await assert.rejects(store.updateAnvilPiece(lib, p.id, { body: { text: 'x' } }), (e: { status?: number }) => e.status === 404);
  await pool.query(`UPDATE users SET platform_guide_editor = true WHERE id = $1`, [editor.userId]);

  // Banned in the clan: no authority there, whatever the seat says.
  await pool.query(`INSERT INTO clan_bans (clan_id, player_id) VALUES ($1, $2)`, [c, flagged.playerId]);
  assert.equal(await store.clanPieceActorFor(flagged.userId, c), null, 'banned here');
});

test('clan scoping: the clan is the actor’s, never the input’s, and another clan’s rows are not found', async () => {
  const store = await import('../src/lib/guidePieces/store.ts');
  const guideId = await libraryGuide('scope-guide');
  const draftGuide = await libraryGuide('scope-draft', 'draft');
  const editor = await user('SEditor', { editor: true });
  const lib = (await store.libraryPieceActorFor(editor.userId))!;
  const a = await clan('scope-a');
  const b = await clan('scope-b');
  const ua = await user('SA');
  const ub = await user('SB');
  await seat(a, ua.userId, 'admin');
  await seat(b, ub.userId, 'admin');
  const actorA = (await store.clanPieceActorFor(ua.userId, a))!;
  const actorB = (await store.clanPieceActorFor(ub.userId, b))!;
  assert.equal(await store.clanPieceActorFor(ua.userId, b), null, "A's admin holds nothing in B");

  const p = await store.createAnvilPiece(lib, { guideId, kind: 'note', body: { text: 'Anvil' }, status: 'published' });
  // A clan id in the body is refused outright, not ignored.
  await assert.rejects(store.saveOverride(actorA, p.id, { body: { text: 'x' }, clanId: b }), /unknown field "clanId"/);
  await assert.rejects(store.addClanPiece(actorA, { guideId, kind: 'note', body: { text: 'x' }, clan_id: b }), /unknown field "clan_id"/);
  const oa = await store.saveOverride(actorA, p.id, { body: { text: 'A’s version' } });
  assert.equal(oa.clanId, a);
  const added = await store.addClanPiece(actorA, { guideId, kind: 'note', body: { text: 'A’s own' } });
  // B can't touch A's rows by id.
  await assert.rejects(store.updateClanPiece(actorB, added.id, { body: { text: 'B was here' } }), (e: { status?: number }) => e.status === 404);
  await assert.rejects(store.deleteClanPiece(actorB, oa.id), (e: { status?: number }) => e.status === 404);
  const revA = (await store.pieceHistory({ overrideId: oa.id, clanId: a }))[0];
  await assert.rejects(store.revertClanPiece(actorB, revA.id), (e: { status?: number }) => e.status === 404);
  assert.equal((await store.pieceHistory({ overrideId: oa.id, clanId: b })).length, 0);
  // B's view of the guide is Anvil's; A's has its own.
  assert.deepEqual((await store.resolveGuide(guideId, b))!.pieces.map((x) => (x.body as { text: string }).text), ['Anvil']);
  assert.deepEqual((await store.resolveGuide(guideId, a))!.pieces.map((x) => (x.body as { text: string }).text).sort(), ['A’s own', 'A’s version']);
  // Drafts: not overridable, not addable to, not readable.
  const draft = await store.createAnvilPiece(lib, { guideId, kind: 'note', body: { text: 'draft' } });
  await assert.rejects(store.saveOverride(actorA, draft.id, { body: { text: 'x' } }), (e: { status?: number }) => e.status === 404);
  await assert.rejects(store.addClanPiece(actorA, { guideId: draftGuide, kind: 'note', body: { text: 'x' } }), (e: { status?: number }) => e.status === 404);
  assert.equal(await store.resolveGuide(draftGuide, null), null);
  assert.ok(await store.resolveGuide(draftGuide, null, { drafts: true }), 'the library editor sees it');
  assert.equal(await store.resolveGuide(draftGuide, a, { drafts: true, editor: true }), null, 'a clan never does');
  assert.equal((await store.resolveGuide(guideId, a, { editor: true, drafts: true }))!.pieces.some((x) => x.pieceId === draft.id), false);
  // A clan guide is not a library guide.
  const own = (await pool.query(`INSERT INTO guides (clan_id, slug, title, body, status, created_at, updated_at) VALUES ($1, 'own', 'own', '', 'published', $2, $2) RETURNING id`, [a, now()])).rows[0].id;
  await assert.rejects(store.createAnvilPiece(lib, { guideId: own, kind: 'note', body: { text: 'x' } }), (e: { status?: number }) => e.status === 404);
  // Hostile bodies are refused on the write path too.
  await assert.rejects(store.saveOverride(actorA, p.id, { body: { text: 'x', html: '<script>' } }), /unknown field/);
  const cleaned = await store.addClanPiece(actorA, { guideId, kind: 'note', body: { text: '<html><img src=x onerror=alert(1)>hi‮' } });
  assert.equal((cleaned.body as { text: string }).text, 'hi');
});

test('overrides: Anvil updated this · keep ours / take theirs; hide; history and revert', async () => {
  const store = await import('../src/lib/guidePieces/store.ts');
  const guideId = await libraryGuide('flow-guide');
  const editor = await user('FEditor', { editor: true });
  const lib = (await store.libraryPieceActorFor(editor.userId))!;
  const c = await clan('flow');
  const u = await user('FAdmin');
  await seat(c, u.userId, 'owner');
  const actor = (await store.clanPieceActorFor(u.userId, c))!;

  const p = await store.createAnvilPiece(lib, { guideId, kind: 'steps', body: { items: [{ text: 'v1' }] }, status: 'published', position: 10 });
  const q = await store.createAnvilPiece(lib, { guideId, kind: 'note', body: { text: 'hide me' }, status: 'published', position: 20 });
  await store.saveOverride(actor, p.id, { body: { items: [{ text: 'ours' }] } });
  let view = (await store.resolveGuide(guideId, c))!.pieces;
  assert.equal(view[0].source, 'clan');
  assert.equal(view[0].anvilChanged, false);

  // Status alone is no new version; a body change is.
  assert.equal((await store.updateAnvilPiece(lib, p.id, { status: 'published' })).version, 1);
  assert.equal((await store.updateAnvilPiece(lib, p.id, { body: { items: [{ text: 'v2' }] } })).version, 2);
  view = (await store.resolveGuide(guideId, c))!.pieces;
  assert.equal(view[0].anvilChanged, true);
  assert.equal(view[0].anvilVersion, 2);
  assert.deepEqual(await store.anvilUpdatesFor(c), [{ overrideId: view[0].overrideId, pieceId: p.id, guideId, basedOnVersion: 1, anvilVersion: 2 }]);

  await store.keepOurs(actor, p.id);
  view = (await store.resolveGuide(guideId, c))!.pieces;
  assert.equal(view[0].anvilChanged, false);
  assert.deepEqual(view[0].body, { items: [{ text: 'ours' }] });

  await store.takeAnvil(actor, p.id);
  view = (await store.resolveGuide(guideId, c))!.pieces;
  assert.equal(view[0].source, 'anvil');
  assert.deepEqual(view[0].body, { items: [{ text: 'v2' }] });

  // Revert brings the clan's version back from its history.
  const hist = await store.pieceHistory({ pieceId: p.id, clanId: c });
  assert.deepEqual(hist.map((h) => h.action), ['take-anvil', 'keep-ours', 'create']);
  await store.revertClanPiece(actor, hist.find((h) => h.action === 'create')!.id);
  assert.deepEqual((await store.resolveGuide(guideId, c))!.pieces[0].body, { items: [{ text: 'ours' }] });

  // Hide and show.
  await store.saveOverride(actor, q.id, { hidden: true });
  assert.equal((await store.resolveGuide(guideId, c))!.pieces.some((x) => x.pieceId === q.id), false);
  assert.equal((await store.resolveGuide(guideId, c, { editor: true }))!.pieces.find((x) => x.pieceId === q.id)?.hidden, true);
  await assert.rejects(store.saveOverride(actor, q.id, { hidden: false }), /body/);
  await store.saveOverride(actor, q.id, { hidden: false, body: { text: 'shown again' } });
  assert.equal((await store.resolveGuide(guideId, c))!.pieces.find((x) => x.pieceId === q.id)?.source, 'clan');

  // Anvil's own history and revert.
  await store.revertAnvilPiece(lib, p.id, 1);
  const back = await store.getAnvilPiece(p.id);
  assert.deepEqual(back?.body, { items: [{ text: 'v1' }] });
  assert.equal(back?.version, 3);
  assert.deepEqual((await store.pieceHistory({ pieceId: p.id })).map((h) => h.action), ['revert', 'update', 'update', 'create']);

  // Anvil deletes a piece: the clan's version stays as its own piece; a clan that only hid one loses the hide.
  const r = await store.createAnvilPiece(lib, { guideId, kind: 'note', body: { text: 'doomed' }, status: 'published', position: 30 });
  const s2 = await store.createAnvilPiece(lib, { guideId, kind: 'note', body: { text: 'doomed too' }, status: 'published', position: 40 });
  await store.saveOverride(actor, r.id, { body: { text: 'kept by the clan' } });
  await store.saveOverride(actor, s2.id, { hidden: true });
  await store.deleteAnvilPiece(lib, r.id);
  await store.deleteAnvilPiece(lib, s2.id);
  const after = (await store.resolveGuide(guideId, c))!.pieces;
  assert.ok(after.some((x) => x.source === 'clan' && x.pieceId === null && (x.body as { text: string }).text === 'kept by the clan'));
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM guide_piece_overrides WHERE clan_id = $1 AND hidden AND piece_id IS NULL`, [c])).rows[0].n, 0);
});

test('converter: dry run writes nothing; apply converts library guides and never clan guides', async () => {
  const { convertLibraryGuides } = await import('../src/lib/guidePieces/convertStore.ts');
  const { rows } = await pool.query(`SELECT id FROM guides WHERE clan_id IS NULL AND slug = 'vorkath-guide'`);
  const vork = rows[0].id as number;
  const before = (await pool.query(`SELECT body, version FROM guides WHERE id = $1`, [vork])).rows[0];
  const dry = await convertLibraryGuides({ guideIds: [vork] });
  assert.equal(dry[0].outcome, 'would-convert');
  assert.ok(dry[0].pieces > 5, `${dry[0].pieces}`);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM guide_pieces WHERE guide_id = $1`, [vork])).rows[0].n, 0);
  const done = await convertLibraryGuides({ guideIds: [vork], apply: true });
  assert.equal(done[0].outcome, 'converted');
  const kinds = (await pool.query(`SELECT kind, variant->>'level' AS level, status FROM guide_pieces WHERE guide_id = $1 ORDER BY position`, [vork])).rows;
  assert.equal(kinds.length, dry[0].pieces);
  assert.ok(kinds.some((k) => k.kind === 'loadout' && k.level === 'advanced'));
  assert.ok(kinds.some((k) => k.kind === 'note'));
  assert.ok(kinds.every((k) => k.status === 'draft'));
  // Run again: left alone.
  assert.equal((await convertLibraryGuides({ guideIds: [vork], apply: true }))[0].outcome, 'has-pieces');
  // The guide itself is untouched.
  assert.deepEqual((await pool.query(`SELECT body, version FROM guides WHERE id = $1`, [vork])).rows[0], before);
  // Every library guide converts with nothing refused but routes.
  const all = await convertLibraryGuides({});
  for (const r of all) for (const s of r.skipped) assert.equal(s.what, 'route block', `${r.slug}: ${s.what} — ${s.why}`);
});
