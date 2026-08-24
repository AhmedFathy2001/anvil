// What the public apex may say about a person.
//
// Three rules, and each failed silently before it was written down:
//
//   /profile is PRIVATE. It is yours, signed in, and it is the one page the Discord display name
//   belongs on.
//
//   /p/<rsn> and /u/<id> are PUBLIC and carry NO Discord identity. They used to: players.display_name
//   is the Discord display name in all but name — every path that creates a person from a login
//   seeds it from there, and on the real data it matched users.display_name for every row that had
//   one — and it was rendered as "played by <name>" on the character page and as the <h1> and the
//   <title> of the person page.
//
//   Sharing a character is not linking it. /u/ listed every shared account of a person together, so
//   sharing a second character silently announced that both belonged to one human. That is the
//   disclosure people are most likely to want kept, and it is the reason sharing is per-account in
//   the first place.
//
// These are assertions about what is ABSENT, which is why they need a test: a page that leaks looks
// exactly like a page that does not, and the leak is only visible to someone who knows the value is
// a Discord name.
//
// Run: npm run test:apexprivacy

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('apex-privacy');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let P: typeof import('../src/lib/apexProfiles.ts');

let personId: number;
const DISCORD_NAME = 'AhmedOnDiscord';

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  P = await import('../src/lib/apexProfiles.ts');

  // A person whose display_name is a Discord handle — which is what the real column holds.
  const [person] = await db.insert(s.players).values({ displayName: DISCORD_NAME }).returning();
  personId = person.id;

  await db.insert(s.accounts).values([
    { playerId: personId, rsn: 'Main Guy', rsnNormalized: 'main guy', shared: true, isPrimary: 1 },
    { playerId: personId, rsn: 'Quiet Iron', rsnNormalized: 'quiet iron', shared: false },
    { playerId: personId, rsn: 'Alt Guy', rsnNormalized: 'alt guy', shared: true },
  ]);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function setLinking(on: boolean) {
  const { db, schema: s } = await loadDb();
  await db.update(s.players).set({ linkAccountsPublicly: on }).where(eq(s.players.id, personId));
}

// ── Linking is its own decision ───────────────────────────────────────────────────────────────

test('sharing two characters does not publish that they are one person', async () => {
  await setLinking(false);
  assert.equal(await P.apexPerson(personId), null, 'no person page without linking');
});

test('and the character page does not name their owner either', async () => {
  await setLinking(false);
  const c = await P.apexCharacter('Main Guy');
  assert.ok(c, 'the character itself is still public — sharing did that');
  assert.equal(c!.owner, null, 'but nothing says whose it is');
});

test('turning linking on is what publishes the connection', async () => {
  await setLinking(true);
  const person = await P.apexPerson(personId);
  assert.ok(person);
  assert.deepEqual(person!.characters.map((c) => c.rsn).sort(), ['Alt Guy', 'Main Guy']);
});

// ── No Discord identity, ever ─────────────────────────────────────────────────────────────────

test('the person is named by their primary shared RSN, not their Discord name', async () => {
  await setLinking(true);
  const person = await P.apexPerson(personId);
  assert.equal(person!.label, 'Main Guy', 'isPrimary wins the label');
  assert.equal(
    JSON.stringify(person).includes(DISCORD_NAME),
    false,
    'the Discord display name must not appear anywhere in the payload',
  );
});

test('nor is it hiding in the character payload', async () => {
  await setLinking(true);
  const c = await P.apexCharacter('Main Guy');
  assert.equal(JSON.stringify(c).includes(DISCORD_NAME), false);
});

test('the owner line names a DIFFERENT character, never the one being read', async () => {
  await setLinking(true);

  // This assertion used to read `owner?.label === 'Main Guy'` on the 'Main Guy' page — it encoded
  // the bug. The label was the person's PRIMARY shared RSN, which is just first in the list and is
  // very often the character you are looking at, so the page said "Main Guy · also plays Main Guy".
  const main = await P.apexCharacter('Main Guy');
  assert.equal(main!.owner?.label, 'Alt Guy', 'their other shared character');

  // And it works from the other side, which a "hide it when the names match" patch would not have:
  // there the label is still chosen without reference to the page you are on.
  const alt = await P.apexCharacter('Alt Guy');
  assert.equal(alt!.owner?.label, 'Main Guy');
});

test('somebody who publishes ONE character has no owner line at all', async () => {
  const { db, schema: s } = await loadDb();
  await setLinking(true);

  // Unshare the alt: now the person publishes only 'Main Guy', so there is no "also", and the person
  // page behind the link would list only the character you are already reading.
  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.rsnNormalized, 'alt guy'));

  const c = await P.apexCharacter('Main Guy');
  assert.equal(c!.owner, null, 'no other character to name, so no line');

  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.rsnNormalized, 'alt guy'));
});

test('an unshared character stays invisible even with linking on', async () => {
  // Linking publishes the connection between SHARED characters. It is not a second way to publish a
  // character, which would make it a trapdoor around the per-account switch.
  await setLinking(true);
  assert.equal(await P.apexCharacter('Quiet Iron'), null);
  const person = await P.apexPerson(personId);
  assert.equal(person!.characters.some((c) => c.rsn === 'Quiet Iron'), false);
});

test('a person who has shared nothing has no page, linked or not', async () => {
  const { db, schema: s } = await loadDb();
  const [ghost] = await db
    .insert(s.players)
    .values({ displayName: 'GhostOnDiscord', linkAccountsPublicly: true })
    .returning();
  assert.equal(await P.apexPerson(ghost.id), null);
});

test('a platform-banned person is not published', async () => {
  const { db, schema: s } = await loadDb();
  await db.update(s.players).set({ banned: true }).where(eq(s.players.id, personId));
  assert.equal(await P.apexPerson(personId), null);
  const c = await P.apexCharacter('Main Guy');
  assert.equal(c?.owner ?? null, null, 'and no longer named as anyone’s owner');
  await db.update(s.players).set({ banned: false }).where(eq(s.players.id, personId));
});

// ── The pages themselves ──────────────────────────────────────────────────────────────────────

test('no public apex page reads players.displayName', () => {
  // A source check, because the value is only wrong in CONTEXT: displayName is correct on /profile
  // and a leak on /u/ and /p/, and no type distinguishes them. Comments are stripped first so the
  // notes explaining why it is absent do not read as a use of it.
  for (const f of ['src/app/u/[id]/page.tsx', 'src/app/p/[rsn]/page.tsx']) {
    const src = readFileSync(join(process.cwd(), f), 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.equal(src.includes('displayName'), false, `${f} must not render a Discord-derived name`);
  }
});

test('/profile refuses a signed-out visitor', () => {
  // The private half of the rule. It is a redirect rather than a 404 because the page exists and is
  // theirs — they just have to say who they are.
  const src = readFileSync(join(process.cwd(), 'src/app/profile/page.tsx'), 'utf-8');
  assert.match(src, /redirect\('\/login\?return=\/profile'\)/);
});
