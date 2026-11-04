// Anvil Supporter profile perks against a real database: the display case (lib/displayCase) and the
// stored avatar/banner read back at the tier in force (lib/profileMedia).
//
// What must hold: a pin is accepted only for an item on the person's OWN verified character; slots
// are the tier now (4 / 8 / 12) and a full case refuses; strangers never see a pin from an unshared
// character; a lapse hides the case and keeps the rows; a character that leaves the person takes its
// pins with it; a lapsed Champion's pictures fall back to the still frame.
//
// Run: TEST_DATABASE_URL=... npx tsx --test tests/supporter-media-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('supporter-media');
const BASE = 'https://media.example.com';
process.env.S3_PUBLIC_BASE_URL = BASE;

// Item prices come from the wiki's API; the case must not depend on the network in a test.
globalThis.fetch = (async () => new Response(JSON.stringify({ data: { 4151: { high: 1_600_000, low: 1_400_000 } } }), { status: 200 })) as typeof fetch;

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let DC: typeof import('../src/lib/displayCase.ts');
let PM: typeof import('../src/lib/profileMedia.ts');

const ids = {} as Record<string, number>;
const NOW = new Date().toISOString();
const ahead = new Date(Date.now() + 30 * 86_400_000).toISOString();

async function setTier(tier: 'supporter' | 'champion' | 'patron' | null) {
  await db.delete(s.supporterSubscriptions).where(eq(s.supporterSubscriptions.userId, ids.user));
  if (tier) {
    await db
      .insert(s.supporterSubscriptions)
      .values({ userId: ids.user, tier, status: 'active', recurrence: 'monthly', currentPeriodEnd: ahead, startedAt: '2026-01-01T00:00:00Z' });
  }
}

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  DC = await import('../src/lib/displayCase.ts');
  PM = await import('../src/lib/profileMedia.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'alpha', name: 'Alpha' }).returning();
  const [me] = await db.insert(s.players).values({ displayName: 'Me' }).returning();
  const [them] = await db.insert(s.players).values({ displayName: 'Them' }).returning();
  ids.player = me.id;
  ids.otherPlayer = them.id;
  const [u] = await db.insert(s.users).values({ playerId: me.id, displayName: 'Me', discordId: 'me-1' }).returning();
  ids.user = u.id;
  const acct = async (playerId: number, rsn: string, verified: boolean, shared: boolean) => {
    const [a] = await db
      .insert(s.accounts)
      .values({ playerId, rsn, rsnNormalized: rsn.toLowerCase(), verifiedAt: verified ? NOW : null, shared })
      .returning();
    const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: a.id, kind: 'member', source: 'roster' }).returning();
    return { a, seat };
  };
  const main = await acct(me.id, 'Mainy', true, true);
  const iron = await acct(me.id, 'Irony', true, false);
  const typed = await acct(me.id, 'Typedin', false, true);
  const other = await acct(them.id, 'Stranger', true, true);
  ids.main = main.a.id;
  ids.iron = iron.a.id;
  ids.typed = typed.a.id;
  ids.other = other.a.id;

  const clog = (accountId: number, itemId: number, pageName: string) =>
    db.insert(s.memberClogItems).values({ accountId, itemId, pageName, firstSeenAt: '2026-10-01 12:00:00', kcAtUnlock: 412 });
  await clog(ids.main, 4151, 'Abyssal Sire');
  await clog(ids.main, 13265, 'Abyssal Sire');
  await clog(ids.main, 12922, 'Zulrah');
  await clog(ids.main, 12932, 'Zulrah');
  await clog(ids.main, 11920, 'King Black Dragon');
  await clog(ids.iron, 12921, 'Zulrah');
  await clog(ids.typed, 4151, 'Abyssal Sire');
  await clog(ids.other, 4151, 'Abyssal Sire');

  const drop = async (seat: number, itemId: number, itemName: string, valueGp: number, key: string) =>
    (
      await db
        .insert(s.moments)
        .values({ clanMemberId: seat, rsn: 'x', kind: 'unique', itemId, itemName, valueGp, source: 'Zulrah', kc: 88, occurredAt: '2026-10-20 18:00:00', dedupKey: key })
        .returning()
    )[0].id;
  ids.myDrop = await drop(main.seat.id, 12922, 'Tanzanite fang', 2_100_000, 'd1');
  ids.theirDrop = await drop(other.seat.id, 12922, 'Tanzanite fang', 2_100_000, 'd2');
  ids.myDeath = (
    await db
      .insert(s.moments)
      .values({ clanMemberId: main.seat.id, rsn: 'x', kind: 'death', itemId: 995, occurredAt: NOW, dedupKey: 'death1' })
      .returning()
  )[0].id;

  // Kill counts: the hiscores sweep, raised by the plugin's live push. Personal bests from the plugin.
  const snap = (bosses: Record<string, number>) =>
    JSON.stringify({ skills: {}, bosses: Object.fromEntries(Object.entries(bosses).map(([k, score]) => [k, { rank: 1, score }])) });
  await db.insert(s.accountStatSnapshots).values([
    { accountId: ids.main, snapshot: snap({ tzKalZuk: 12, chambersOfXeric: 350, zulrah: -1 }) },
    { accountId: ids.iron, snapshot: snap({ vorkath: 40 }) },
    { accountId: ids.other, snapshot: snap({ tzKalZuk: 99 }) },
  ]);
  await db.update(s.accounts).set({ liveStats: JSON.stringify({ chambersOfXeric: 352 }) }).where(eq(s.accounts.id, ids.main));
  const best = (accountId: number, activity: string, teamSize: number, centis: number) =>
    db.insert(s.memberPersonalBests).values({ accountId, activity, teamSize, centis, achievedAt: '2026-10-02T10:00:00Z', updatedAt: NOW });
  await best(ids.main, 'vardorvis (awakened)', 0, 11240);
  await best(ids.iron, 'chambers of xeric', 3, 160000);
  await best(ids.other, 'tzkal-zuk', 0, 300000);
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const pin = (input: Parameters<typeof DC.pinToDisplayCase>[3], tier: Parameters<typeof DC.pinToDisplayCase>[2]) =>
  DC.pinToDisplayCase(ids.user, ids.player, tier, input);

test('no tier, no case: pinning is refused', async () => {
  const r = await pin({ kind: 'clog', accountId: ids.main, itemId: 4151 }, null);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.status, 403);
});

test('pins only from their own verified characters, and only items really there', async () => {
  await setTier('supporter');
  const whip = await pin({ kind: 'clog', accountId: ids.main, itemId: 4151 }, 'supporter');
  assert.ok(whip.ok);
  // Twice is the same pin.
  const again = await pin({ kind: 'clog', accountId: ids.main, itemId: 4151 }, 'supporter');
  assert.deepEqual(again, whip);

  const refused = [
    await pin({ kind: 'clog', accountId: ids.main, itemId: 99999 }, 'supporter'), // not in their log
    await pin({ kind: 'clog', accountId: ids.typed, itemId: 4151 }, 'supporter'), // unverified character
    await pin({ kind: 'clog', accountId: ids.other, itemId: 4151 }, 'supporter'), // somebody else's
    await pin({ kind: 'drop', momentId: ids.theirDrop }, 'supporter'), // somebody else's drop
    await pin({ kind: 'drop', momentId: ids.myDeath }, 'supporter'), // not a drop
  ];
  for (const r of refused) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 404);
  }

  assert.ok((await pin({ kind: 'drop', momentId: ids.myDrop }, 'supporter')).ok);
  assert.ok((await pin({ kind: 'clog', accountId: ids.iron, itemId: 12921 }, 'supporter')).ok); // private character
  assert.ok((await pin({ kind: 'clog', accountId: ids.main, itemId: 13265 }, 'supporter')).ok);
  const full = await pin({ kind: 'clog', accountId: ids.main, itemId: 12932 }, 'supporter');
  assert.equal(full.ok, false);
  if (!full.ok) assert.equal(full.status, 409);
});

test('read back: names, values, kc, proof link; strangers never see the unshared character', async () => {
  const mine = await DC.readDisplayCase(ids.user, ids.player);
  assert.equal(mine.length, 4);
  const whip = mine.find((e) => e.itemId === 4151)!;
  assert.equal(whip.name, 'Abyssal whip');
  assert.equal(whip.valueGp, 1_500_000);
  assert.equal(whip.kc, 412);
  assert.equal(whip.icon.endsWith('/4151.png'), true);
  assert.equal(whip.proofHref, '/p/Mainy?tab=collection&page=Abyssal%20Sire');
  const fang = mine.find((e) => e.kind === 'drop')!;
  assert.equal(fang.name, 'Tanzanite fang');
  assert.equal(fang.valueGp, 2_100_000);
  assert.equal(fang.source, 'Zulrah');
  const pet = mine.find((e) => e.accountId === ids.iron)!;
  assert.equal(pet.shared, false);
  assert.equal(pet.proofHref, null);

  const publicCase = await DC.displayCaseForPlayer(ids.player, { publicView: true });
  assert.equal(publicCase.length, 3);
  assert.ok(publicCase.every((e) => e.rsn !== 'Irony'));
  const onIronPage = await DC.displayCaseForPlayer(ids.player, { accountId: ids.iron, publicView: true });
  assert.deepEqual(onIronPage, []);
  const onMainPage = await DC.displayCaseForPlayer(ids.player, { accountId: ids.main, publicView: true });
  assert.equal(onMainPage.length, 3);
});

test('reorder and remove', async () => {
  const before = await DC.readDisplayCase(ids.user, ids.player);
  const reversed = before.map((e) => e.id).reverse();
  await DC.reorderDisplayCase(ids.user, [...reversed, 999999]); // a foreign id is ignored
  assert.deepEqual((await DC.readDisplayCase(ids.user, ids.player)).map((e) => e.id), reversed);
  await DC.unpinFromDisplayCase(ids.user, reversed[0]);
  assert.equal((await DC.readDisplayCase(ids.user, ids.player)).length, 3);
  // Somebody else's id deletes nothing of theirs.
  await DC.unpinFromDisplayCase(ids.user + 1000, reversed[1]);
  assert.equal((await DC.readDisplayCase(ids.user, ids.player)).length, 3);
});

test('a lapse hides the case and keeps every row; Champion opens 8 slots', async () => {
  await setTier(null);
  assert.deepEqual(await DC.displayCaseForPlayer(ids.player, { publicView: true }), []);
  const kept = await db.select().from(s.displayCaseItems).where(eq(s.displayCaseItems.userId, ids.user));
  assert.equal(kept.length, 3);

  await setTier('champion');
  for (const itemId of [12922, 12932, 11920]) assert.ok((await pin({ kind: 'clog', accountId: ids.main, itemId }, 'champion')).ok);
  assert.equal((await DC.readDisplayCase(ids.user, ids.player)).length, 6);

  // Back down to Supporter: the first four show, the rest are kept.
  await setTier('supporter');
  const shown = await DC.displayCaseFor(ids.user, ids.player, 'supporter');
  assert.equal(shown.length, 4);
  assert.equal((await db.select().from(s.displayCaseItems).where(eq(s.displayCaseItems.userId, ids.user))).length, 6);
});

test('a character that leaves the person takes its pins with it', async () => {
  await db.update(s.accounts).set({ playerId: ids.otherPlayer }).where(eq(s.accounts.id, ids.main));
  const left = await DC.readDisplayCase(ids.user, ids.player);
  assert.ok(left.every((e) => e.accountId !== ids.main));
  await db.update(s.accounts).set({ playerId: ids.player }).where(eq(s.accounts.id, ids.main));
});

test('candidates: their verified characters only, one per drop item', async () => {
  const c = await DC.displayCaseCandidates(ids.player);
  assert.ok(c.length > 0);
  assert.ok(c.every((x) => x.accountId === ids.main || x.accountId === ids.iron));
  assert.equal(c.filter((x) => x.kind === 'drop').length, 1);
});

test('kill counts and personal bests: candidates, pins, the live value on read, privacy', async () => {
  await db.delete(s.displayCaseItems).where(eq(s.displayCaseItems.userId, ids.user));
  await setTier('supporter');

  const c = await DC.displayCaseCandidates(ids.player);
  const kcs = c.filter((x) => x.kind === 'kc');
  const pbs = c.filter((x) => x.kind === 'pb');
  // Only what they have, on their own verified characters; unranked zulrah is no candidate.
  assert.deepEqual(kcs.map((x) => `${x.rsn} ${x.name} ${x.headline}`).sort(), [
    'Irony Vorkath 40 KC',
    'Mainy Chambers of Xeric 352 KC',
    'Mainy TzKal-Zuk 12 KC',
  ]);
  assert.deepEqual(pbs.map((x) => `${x.rsn} ${x.name} ${x.headline}`).sort(), [
    'Irony Chambers of Xeric (3 players) 26:40.00',
    'Mainy Vardorvis (Awakened) 1:52.40',
  ]);
  assert.ok(kcs.every((x) => x.icon.length > 0) && pbs.every((x) => x.icon.length > 0));

  const zuk = await pin({ kind: 'kc', accountId: ids.main, statKey: 'tzKalZuk' }, 'supporter');
  assert.ok(zuk.ok);
  assert.deepEqual(await pin({ kind: 'kc', accountId: ids.main, statKey: 'tzKalZuk' }, 'supporter'), zuk); // twice is one pin
  assert.ok((await pin({ kind: 'pb', accountId: ids.main, statKey: '0:vardorvis (awakened)' }, 'supporter')).ok);
  assert.ok((await pin({ kind: 'kc', accountId: ids.iron, statKey: 'vorkath' }, 'supporter')).ok); // private character

  const refused = [
    await pin({ kind: 'kc', accountId: ids.main, statKey: 'zulrah' }, 'supporter'), // unranked: nothing to show
    await pin({ kind: 'kc', accountId: ids.main, statKey: 'vorkath' }, 'supporter'), // not on that character
    await pin({ kind: 'kc', accountId: ids.other, statKey: 'tzKalZuk' }, 'supporter'), // somebody else's
    await pin({ kind: 'kc', accountId: ids.typed, statKey: 'tzKalZuk' }, 'supporter'), // unverified
    await pin({ kind: 'pb', accountId: ids.main, statKey: '1:vardorvis (awakened)' }, 'supporter'), // no such team size
    await pin({ kind: 'pb', accountId: ids.other, statKey: '0:tzkal-zuk' }, 'supporter'),
  ];
  for (const r of refused) {
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.status, 404);
  }

  let mine = await DC.readDisplayCase(ids.user, ids.player);
  assert.equal(mine.length, 3);
  const zukPin = mine.find((e) => e.kind === 'kc' && e.statKey === 'tzKalZuk')!;
  assert.equal(zukPin.headline, '12 KC');
  assert.equal(zukPin.name, 'TzKal-Zuk');
  assert.equal(mine.find((e) => e.kind === 'pb')!.headline, '1:52.40');

  // The value shown is the value now: more kills, a faster time.
  await db.update(s.accounts).set({ liveStats: JSON.stringify({ chambersOfXeric: 352, tzKalZuk: 13 }) }).where(eq(s.accounts.id, ids.main));
  await db
    .update(s.memberPersonalBests)
    .set({ centis: 10950 })
    .where(eq(s.memberPersonalBests.accountId, ids.main));
  mine = await DC.readDisplayCase(ids.user, ids.player);
  assert.equal(mine.find((e) => e.statKey === 'tzKalZuk')!.headline, '13 KC');
  assert.equal(mine.find((e) => e.kind === 'pb')!.headline, '1:49.50');

  // Strangers never see the unshared character's pin; the owner does.
  let shown = await DC.displayCaseForPlayer(ids.player, { publicView: true });
  assert.deepEqual(shown.map((e) => e.statKey).sort(), ['0:vardorvis (awakened)', 'tzKalZuk']);
  // Unshare the main: its pins go dark for others, and stay for the owner.
  await db.update(s.accounts).set({ shared: false }).where(eq(s.accounts.id, ids.main));
  shown = await DC.displayCaseForPlayer(ids.player, { publicView: true });
  assert.deepEqual(shown, []);
  assert.equal((await DC.displayCaseForPlayer(ids.player)).length, 3);
  await db.update(s.accounts).set({ shared: true }).where(eq(s.accounts.id, ids.main));

  // A record that goes away takes its pin with it, with no write.
  await db.delete(s.memberPersonalBests).where(eq(s.memberPersonalBests.accountId, ids.main));
  mine = await DC.readDisplayCase(ids.user, ids.player);
  assert.equal(mine.filter((e) => e.kind === 'pb').length, 0);
  assert.equal((await db.select().from(s.displayCaseItems).where(eq(s.displayCaseItems.userId, ids.user))).length, 3);
});

test('stored pictures: animated for a Champion, the still after a lapse, nothing foreign', async () => {
  const u = (id: string) => `${BASE}/profiles/${ids.user}/${id}.webp`;
  const anim = '0f8fad5b-d9cb-469f-a165-70867728950e';
  const still = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
  await db.insert(s.profileMedia).values({ userId: ids.user, avatarUrl: u(anim), avatarStillUrl: u(still), bannerUrl: u(anim), bannerStillUrl: u(still), bannerPosition: 20 });

  await setTier('champion');
  const champ = await PM.profileMediaForPlayer(ids.player);
  assert.equal(champ.avatar?.animated, true);
  assert.equal(champ.avatar?.src, u(anim));
  assert.equal(champ.banner?.position, 20);
  // A list asks for the still.
  assert.equal((await PM.profileMediaForPlayer(ids.player, { still: true })).banner?.animated, false);

  await setTier('supporter');
  const lapsed = await PM.profileMediaForUser(ids.user);
  assert.deepEqual(lapsed.avatar, { src: u(still), still: u(still), animated: false });

  await db.update(s.profileMedia).set({ avatarStillUrl: 'https://tracker.example/pixel.gif' }).where(eq(s.profileMedia.userId, ids.user));
  assert.equal((await PM.profileMediaForUser(ids.user)).avatar, null);

  // Nobody else's person page picks these up.
  assert.deepEqual(await PM.profileMediaForPlayer(ids.otherPlayer), { avatar: null, banner: null });
});
