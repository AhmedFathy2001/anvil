// Clan events against a real database (lib/clanEvents): scheduling, "I'm going" per occurrence, the
// reminder and "starting now" each claimed once, and the plugin's Clan tab and going action.
//
// Run: npx tsx --test tests/clan-events-db.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('clan-events');

let db: Awaited<ReturnType<typeof loadDb>>['db'];
let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let s: Awaited<ReturnType<typeof loadDb>>['schema'];
let CE: typeof import('../src/lib/clanEvents.ts');
let V: typeof import('../src/lib/pluginUi/views.ts');
let clanId = 0;
let meUser = 0;
const TOKEN = 'ce-token';
const STRANGER = 'ce-stranger';

before(async () => {
  await resetDatabase(DB);
  ({ db, pool, schema: s } = await loadDb());
  CE = await import('../src/lib/clanEvents.ts');
  V = await import('../src/lib/pluginUi/views.ts');
  clanId = (await db.insert(s.clans).values({ slug: 'masses', name: 'Masses' }).returning())[0].id;
  const [me] = await db.insert(s.players).values({ displayName: 'Me' }).returning();
  meUser = (await db.insert(s.users).values({ displayName: 'Massgoer', discordId: 'ce-me', pluginToken: TOKEN, playerId: me.id }).returning())[0].id;
  const [main] = await db.insert(s.accounts).values({ playerId: me.id, rsn: 'Mass Main', rsnNormalized: 'mass main', shared: false, claimedAt: new Date().toISOString() }).returning();
  await db.insert(s.clanMemberships).values({ clanId, accountId: main.id, kind: 'member' });
  const [other] = await db.insert(s.players).values({ displayName: 'Stranger' }).returning();
  await db.insert(s.users).values({ displayName: 'Stranger', discordId: 'ce-x', pluginToken: STRANGER, playerId: other.id });
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

const input = (startsAt: string, over: Record<string, unknown> = {}) => {
  const p = CE.parseClanEventInput({ title: 'Nex mass', location: 'Ancient Prison', world: 330, startsAt, durationMin: 90, repeat: 'weekly', timezone: 'Europe/London', icon: 'nex', ...over });
  assert.ok(p.ok);
  return p.input;
};

test('a form is checked before anything is saved', () => {
  assert.deepEqual(CE.parseClanEventInput({ title: '', startsAt: '2026-11-01T20:00:00Z', durationMin: 60 }), { ok: false, error: 'Give it a name.' });
  assert.equal((CE.parseClanEventInput({ title: 'x', startsAt: 'soon', durationMin: 60 }) as { ok: false }).ok, false);
  assert.equal((CE.parseClanEventInput({ title: 'x', startsAt: '2026-11-01T20:00:00Z', durationMin: 60, world: 12 }) as { error: string }).error, 'That isn’t a world number.');
  const p = CE.parseClanEventInput({ title: ' Mass ', startsAt: '2026-11-01T20:00:00Z', durationMin: 60, timezone: 'Not/AZone', icon: 'https://evil' });
  assert.ok(p.ok && p.input.timezone === 'UTC' && p.input.icon === null && p.input.title === 'Mass', 'a bad zone falls back to UTC; an icon is a game key, never a URL');
});

test('its own picture must be an upload from here, and Discord gets it over the boss icon', () => {
  const base = { title: 'Mass', startsAt: '2026-11-01T20:00:00Z', durationMin: 60 };
  assert.equal((CE.parseClanEventInput({ ...base, imageUrl: 'https://evil.example/x.png' }) as { ok: boolean }).ok, false);
  // A browser reads `\` as `/`, so this is `//evil.example` — another site, dressed as a path.
  assert.equal((CE.parseClanEventInput({ ...base, imageUrl: '/\\evil.example/x.png' }) as { ok: boolean }).ok, false);
  const ok = CE.parseClanEventInput({ ...base, imageUrl: '/uploads/mass.png', icon: 'nex' });
  assert.ok(ok.ok && ok.input.imageUrl === '/uploads/mass.png');
  const ev = { title: 'Mass', description: null, location: null, world: null, icon: 'nex', host: null, repeat: 'none', modules: null };
  // A relative path isn't fetchable by Discord, so the boss icon stays.
  const relative = CE.clanEventEmbed({ ...ev, imageUrl: '/uploads/mass.png' }, null, 0, null, 'announce');
  assert.ok(relative.thumbnail && !relative.thumbnail.url.includes('/uploads/'));
  const absolute = CE.clanEventEmbed({ ...ev, imageUrl: 'https://media.anvilosrs.com/mass.png' }, null, 0, null, 'announce');
  assert.equal(absolute.thumbnail?.url, 'https://media.anvilosrs.com/mass.png');
});

test('an information-only event has no count in Discord and refuses "I\'m going"', async () => {
  const ev = { title: 'Drop party', description: null, location: null, world: null, icon: null, imageUrl: null, host: null, repeat: 'none', modules: { rsvp: false } };
  const embed = CE.clanEventEmbed(ev, null, 0, 'https://x.test/e', 'announce');
  assert.equal(embed.fields?.some((f) => f.name === 'Going'), false);
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const created = await CE.createClanEvent(clanId, input(start), meUser);
  await CE.setClanEventModules(clanId, created.id, { rsvp: false });
  const r = await CE.setGoing(clanId, created.id, { userId: meUser, playerId: null, displayName: 'Info' }, true);
  assert.equal(r.ok, false);
});

test('picked channels are stored and posted as mentions', async () => {
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const parsed = CE.parseClanEventInput({ ...input(start), channels: { voice: { id: '123456789012345678', name: 'Mass VC' } } } as unknown as Record<string, unknown>);
  assert.ok(parsed.ok);
  const ev = await CE.createClanEvent(clanId, parsed.input, meUser);
  const view = await CE.getClanEvent(clanId, ev.id, null);
  assert.deepEqual(view?.channels, { voice: { id: '123456789012345678', name: 'Mass VC' } });
  const embed = CE.clanEventEmbed(ev, null, 0, null, 'announce');
  assert.equal(embed.fields?.find((f) => f.name === 'Channels')?.value, 'Voice <#123456789012345678>');
});

test('going is per occurrence: next week asks again', async () => {
  const start = new Date(Date.now() + 3_600_000).toISOString();
  const ev = await CE.createClanEvent(clanId, input(start), meUser);
  const me = { userId: meUser, playerId: null, displayName: 'Massgoer' };
  const going = async (on: boolean) => {
    const r = await CE.setGoing(clanId, ev.id, me, on);
    assert.ok(r.ok);
    return r.view;
  };
  let view = await going(true);
  assert.equal(view?.going, 1);
  assert.equal(view?.mine, true);
  assert.deepEqual(view?.goingNames, ['Massgoer']);
  view = await going(true);
  assert.equal(view?.going, 1, 'saying it twice is still one');
  const nextWeek = await CE.listClanEvents(clanId, { userId: meUser, now: Date.parse(start) + 8 * 86_400_000 });
  assert.equal(nextWeek.find((x) => x.id === ev.id)?.going, 0);
  view = await going(false);
  assert.equal(view?.going, 0);
  assert.equal((await CE.listClanEvents(clanId, { withinDays: 1 })).some((x) => x.id === ev.id), true);
  assert.equal(await CE.cancelClanEvent(clanId, ev.id), true);
  assert.equal((await CE.listClanEvents(clanId)).some((x) => x.id === ev.id), false, 'called off: gone from every list');
});

test('the reminder and "starting now" are claimed once per occurrence', async () => {
  const start = Date.now() + 10 * 60_000; // inside the 15-minute window
  const ev = await CE.createClanEvent(clanId, input(new Date(start).toISOString(), { repeat: 'none' }), meUser);
  const row = () => db.query.clanEvents.findFirst({ where: (t, { eq }) => eq(t.id, ev.id) });
  await CE.processClanEventReminders(Date.now());
  assert.equal((await row())?.remindedFor, new Date(start).toISOString());
  await CE.processClanEventReminders(Date.now());
  assert.equal((await row())?.startedFor, null);
  await CE.processClanEventReminders(start + 60_000);
  assert.equal((await row())?.startedFor, new Date(start).toISOString());
  // Moving it resets both, so the new time is reminded again.
  await CE.updateClanEvent(clanId, ev.id, input(new Date(start + 86_400_000).toISOString(), { repeat: 'none' }));
  assert.equal((await row())?.remindedFor, null);
});

test('the plugin says "I\'m going" for a member, and not for a stranger', async () => {
  const ev = await CE.createClanEvent(clanId, input(new Date(Date.now() + 2 * 3_600_000).toISOString(), { title: 'Skilling hangout', repeat: 'none' }), meUser);
  const post = (token: string) =>
    V.pluginAct(new Request('http://site/api/plugin/ui', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-RSN': 'Mass Main' } }), 'clan-event-going', { id: String(ev.id), going: '1', open: `clan-event:${ev.id}`, clan: 'masses' }, {});
  await post(STRANGER);
  assert.equal((await CE.getClanEvent(clanId, ev.id))?.going, 0, 'not in the clan');
  await post(TOKEN);
  const after = await CE.getClanEvent(clanId, ev.id, meUser);
  assert.equal(after?.going, 1);
  assert.equal(after?.mine, true);
});
