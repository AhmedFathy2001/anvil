// A person's profile in a clan lists EVERY character they own, marked member / guest / not here
// (lib/memberProfile getPersona), once the person agreed to link their characters.
//
// Run: npx tsx --test tests/persona-characters.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('personachars');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let seatHere: number;
let personId: number;
let dbRef: Awaited<ReturnType<typeof loadDb>>['db'];
let schemaRef: Awaited<ReturnType<typeof loadDb>>['schema'];

before(async () => {
  await resetDatabase(DB);
  const loaded = await loadDb();
  pool = loaded.pool;
  const { db, schema: s } = loaded;
  const here = (await db.insert(s.clans).values({ slug: 'here', name: 'Here' }).returning())[0].id;
  const there = (await db.insert(s.clans).values({ slug: 'there', name: 'There' }).returning())[0].id;
  const person = (await db.insert(s.players).values({ displayName: 'Multi', linkAccountsPublicly: true }).returning())[0].id;
  personId = person;
  dbRef = db;
  schemaRef = s;
  const now = new Date().toISOString();
  const mk = async (rsn: string, extra: Record<string, unknown> = {}) =>
    (await db.insert(s.accounts).values({ playerId: person, rsn, rsnNormalized: rsn.toLowerCase(), claimedAt: now, ...extra }).returning())[0].id;

  const main = await mk('Main', { isPrimary: 1 });
  const alt = await mk('Alt', { accountType: 'hardcore' });
  const elsewhere = await mk('Elsewhere');
  const another = await mk('Another');

  seatHere = (await db.insert(s.clanMemberships).values({ clanId: here, accountId: main, kind: 'member' }).returning())[0].id;
  await db.insert(s.clanMemberships).values({ clanId: here, accountId: alt, kind: 'guest' });
  await db.insert(s.clanMemberships).values({ clanId: there, accountId: elsewhere, kind: 'member' });
  await db.insert(s.clanMemberships).values({ clanId: there, accountId: another, kind: 'member' });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

// The card as someone INSIDE the clan reads it; a visitor from outside is the last test.
const CLANMATE = { insider: true };

test('every character, with where it stands here', async () => {
  const { getPersona } = await import('../src/lib/memberProfile.ts');
  const p = await getPersona(seatHere, CLANMATE);
  assert.ok(p);
  const byRsn = new Map(p.accounts.map((a) => [a.rsn, a]));
  assert.equal(byRsn.get('Main')?.status, 'member');
  assert.equal(byRsn.get('Alt')?.status, 'guest');
  assert.equal(byRsn.get('Alt')?.accountType, 'hardcore');
  assert.equal(byRsn.get('Elsewhere')?.status, 'out');
  assert.equal(byRsn.get('Elsewhere')?.id, null, 'no seat here to link to');
  assert.equal(byRsn.get('Another')?.status, 'out');
  assert.equal(p.accounts[0].rsn, 'Main', 'the main first');
});

test('without the person’s consent to link their characters, only the ones seated here show', async () => {
  const { eq } = await import('drizzle-orm');
  const { getPersona } = await import('../src/lib/memberProfile.ts');
  await dbRef.update(schemaRef.players).set({ linkAccountsPublicly: false }).where(eq(schemaRef.players.id, personId));
  const p = await getPersona(seatHere, CLANMATE);
  assert.deepEqual(p?.accounts.map((a) => a.rsn).sort(), ['Alt', 'Main']);
});

test('a visitor from outside the clan gets no Discord identity and nothing the person did not publish and link', async () => {
  const { eq } = await import('drizzle-orm');
  const { getPersona } = await import('../src/lib/memberProfile.ts');
  // Linking is off (the test above): to an outsider there is no card at all.
  assert.equal(await getPersona(seatHere), null);
  await dbRef.update(schemaRef.players).set({ linkAccountsPublicly: true }).where(eq(schemaRef.players.id, personId));
  const p = await getPersona(seatHere);
  assert.ok(p);
  assert.equal(p.discordUsername, null);
  assert.equal(p.avatarUrl, null);
  assert.deepEqual(p.accounts.map((a) => a.rsn).sort(), ['Alt', 'Another', 'Elsewhere', 'Main']);
  assert.equal('discordId' in p, false);
});
