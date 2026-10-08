import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planTeamPlacement,
  generateJoinCode,
  sanitizeForDm,
  buildJoinDm,
  classifyRolePut,
  dueForRecheck,
  inviteStillUsable,
  scopeAllowsJoin,
  isDiscordLayout,
} from '../src/lib/eventDiscordPlan.ts';

test('joint: clan team gets an event-server role and private planning in its OWN server', () => {
  const plan = planTeamPlacement('joint', { clanId: 7 });
  assert.deepEqual(plan, [
    { purpose: 'event', server: 'event', clanId: null, privateChannels: false },
    { purpose: 'planning', server: 'clan', clanId: 7, privateChannels: true },
  ]);
});

test('joint: a drafted team (no clan) plans privately in the event server', () => {
  const plan = planTeamPlacement('joint', { clanId: null });
  assert.deepEqual(plan, [{ purpose: 'event', server: 'event', clanId: null, privateChannels: true }]);
});

test('single: everything in the one server; own: nothing for this module', () => {
  assert.deepEqual(planTeamPlacement('single', { clanId: 3 }), [
    { purpose: 'event', server: 'event', clanId: null, privateChannels: true },
  ]);
  assert.deepEqual(planTeamPlacement('own', { clanId: 3 }), []);
});

test('layout guard', () => {
  assert.ok(isDiscordLayout('joint'));
  assert.ok(!isDiscordLayout('JOINT'));
  assert.ok(!isDiscordLayout(null));
});

test('join codes are ANV- plus 6 unambiguous chars', () => {
  for (let i = 0; i < 200; i++) {
    const code = generateJoinCode();
    assert.match(code, /^ANV-[A-HJKMNP-Z2-9]{6}$/);
  }
  assert.equal(generateJoinCode(() => new Uint8Array(6)), 'ANV-AAAAAA');
});

test('DM text cannot carry links, mentions or markdown links from admin-typed names', () => {
  assert.equal(sanitizeForDm('discord.gg/freenitro'), '(link removed)');
  assert.ok(!sanitizeForDm('Team https://evil.example/x').includes('http'));
  assert.ok(!sanitizeForDm('[click](https://x.co)').includes('http'));
  assert.ok(!sanitizeForDm('free-nitro.gift now').includes('.gift'));
  assert.equal(sanitizeForDm('@everyone hi'), 'everyone hi');
  assert.equal(sanitizeForDm('<@123456> team'), 'team');
  assert.equal(sanitizeForDm('AFK Spot'), 'AFK Spot');
  assert.equal(sanitizeForDm('   '), 'your event');
  assert.equal(sanitizeForDm('x'.repeat(200)).length, 80);
});

test('the DM never contains a Discord invite and carries the code + page link', () => {
  const dm = buildJoinDm({
    eventName: 'Bingo discord.gg/abc',
    teamName: 'LFL https://discord.com/invite/zzz',
    pageUrl: 'https://lfl.anvilosrs.com/events/12/discord',
    code: 'ANV-ABC234',
  });
  const text = JSON.stringify(dm);
  assert.ok(!/discord\.gg|discord\.com\/invite/i.test(text));
  assert.ok(text.includes('ANV-ABC234'));
  assert.ok(text.includes('https://lfl.anvilosrs.com/events/12/discord'));
  assert.ok(text.includes('lfl.anvilosrs.com'));
  assert.deepEqual((dm as { allowed_mentions: unknown }).allowed_mentions, { parse: [] });
});

test('role PUT classification', () => {
  assert.equal(classifyRolePut(204), 'joined');
  assert.equal(classifyRolePut(404, 10007), 'not-member');
  assert.equal(classifyRolePut(404), 'not-member');
  assert.equal(classifyRolePut(404, 10011), 'error'); // unknown role
  assert.equal(classifyRolePut(403, 50013), 'error');
});

test('recheck throttle and invite reuse', () => {
  const now = new Date('2026-10-08T12:00:00Z');
  assert.ok(dueForRecheck(null, now, 60_000));
  assert.ok(!dueForRecheck('2026-10-08 11:59:30', now, 60_000));
  assert.ok(dueForRecheck('2026-10-08 11:58:00', now, 60_000));
  assert.ok(dueForRecheck('2026-10-08T11:58:00.000Z', now, 60_000));
  assert.ok(inviteStillUsable('2026-10-08T13:00:00.000Z', now));
  assert.ok(!inviteStillUsable('2026-10-08T12:05:00.000Z', now));
  assert.ok(!inviteStillUsable(null, now));
});

test('guilds.join scope detection', () => {
  assert.ok(scopeAllowsJoin('identify email guilds.join'));
  assert.ok(!scopeAllowsJoin('identify email'));
  assert.ok(!scopeAllowsJoin(undefined));
});
