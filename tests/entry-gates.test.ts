// Creator entry gates — the pure rules (lib/entryGates) and the Twitch client (lib/twitch), with no
// database and no network: every Twitch answer here is a mocked fetch.
//
// Run: npm run test:gates

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GateCache,
  GATE_FAIL_TTL_MS,
  GATE_PASS_TTL_MS,
  checkGates,
  discordMemberFacts,
  gatesApply,
  gatesSummary,
  parseGates,
  serializeGates,
  twitchAlreadyUsed,
  twitchTierOf,
  validateGatesFor,
  verdictMessage,
  type DiscordAnswer,
  type EntryGates,
  type GateOptions,
  type GateProbe,
  type TwitchAnswer,
} from '../src/lib/entryGates.ts';
import {
  HOST_SCOPES,
  authorizeUrl,
  exchangeCode,
  fetchUser,
  followsChannel,
  hasHostScopes,
  refreshToken,
  signState,
  subscriptionTier,
  twitchConfig,
  verifyState,
  TwitchAuthError,
  type FetchLike,
  type TwitchConfig,
  type TwitchState,
} from '../src/lib/twitch.ts';

const ROLE = '123456789012345678';
const ctx = { twitchLogin: 'coolstreamer', hostName: 'Cool Streamer' };

// ── parseGates ───────────────────────────────────────────────────────────────────────────────────

test('parseGates keeps only what the checker understands', () => {
  assert.equal(parseGates(null), null);
  assert.equal(parseGates(''), null);
  assert.equal(parseGates('not json'), null);
  assert.equal(parseGates({ anyOf: [] }), null, 'nothing left means anyone');
  assert.equal(parseGates({ anyOf: [{ kind: 'carrier-pigeon' }] }), null, 'unknown kinds dropped');

  const g = parseGates({
    anyOf: [
      { kind: 'twitch-follow', extra: 'x' },
      { kind: 'twitch-follow' },
      { kind: 'twitch-sub', tier: 3 },
      { kind: 'twitch-sub', tier: 2 },
      { kind: 'twitch-sub', tier: 9 },
      { kind: 'discord-role', roleId: ROLE, roleName: '  @@Subs\u0007 ' },
      { kind: 'discord-role', roleId: ROLE, roleName: 'dupe' },
      { kind: 'discord-role', roleId: '12; drop table', roleName: 'bad' },
      { kind: 'discord-booster' },
    ],
  });
  assert.deepEqual(g, {
    anyOf: [
      { kind: 'twitch-follow' },
      { kind: 'twitch-sub', tier: 2 },
      { kind: 'discord-role', roleId: ROLE, roleName: 'Subs' },
      { kind: 'discord-booster' },
    ],
  });
  // Round trip through the column.
  assert.deepEqual(parseGates(serializeGates(g)), g);
  assert.equal(serializeGates(null), null);
});

test('parseGates caps roles and role-name length', () => {
  const roles = Array.from({ length: 9 }, (_, i) => ({ kind: 'discord-role', roleId: `1000000000000000${10 + i}`, roleName: 'x'.repeat(300) }));
  const g = parseGates({ anyOf: roles })!;
  assert.equal(g.anyOf.length, 5);
  assert.equal((g.anyOf[0] as { roleName: string }).roleName.length, 100);
});

test('gates only apply on a creator space', () => {
  const g = parseGates({ anyOf: [{ kind: 'twitch-follow' }] });
  assert.equal(gatesApply('creator', g), true);
  assert.equal(gatesApply('clan', g), false);
  assert.equal(gatesApply(null, g), false);
  assert.equal(gatesApply('creator', null), false);
});

// ── checkGates ───────────────────────────────────────────────────────────────────────────────────

function probe(over: {
  follows?: TwitchAnswer<boolean>;
  sub?: TwitchAnswer<0 | 1 | 2 | 3>;
  member?: DiscordAnswer;
}): GateProbe & { calls: Record<string, number> } {
  const calls = { follows: 0, sub: 0, member: 0 };
  return {
    calls,
    twitchFollows: async () => {
      calls.follows++;
      return over.follows ?? { state: 'ok', value: false };
    },
    twitchSubTier: async () => {
      calls.sub++;
      return over.sub ?? { state: 'ok', value: 0 };
    },
    discordMember: async () => {
      calls.member++;
      return over.member ?? { state: 'ok', member: false };
    },
  };
}

const ALL: EntryGates = {
  anyOf: [
    { kind: 'twitch-follow' },
    { kind: 'twitch-sub', tier: 2 },
    { kind: 'discord-role', roleId: ROLE, roleName: 'Subs' },
    { kind: 'discord-booster' },
  ],
};

test('any-of: the first rule that passes wins, and later questions are never asked', async () => {
  const p = probe({ follows: { state: 'ok', value: true } });
  assert.deepEqual(await checkGates(ALL, p, ctx), { pass: true, via: 'twitch-follow' });
  assert.deepEqual(p.calls, { follows: 1, sub: 0, member: 0 });
});

test('a Discord role passes after Twitch says no; the member lookup is asked once for two rules', async () => {
  const p = probe({ member: { state: 'ok', member: true, roles: [ROLE], boosting: false } });
  assert.deepEqual(await checkGates(ALL, p, ctx), { pass: true, via: 'discord-role' });
  assert.deepEqual(p.calls, { follows: 1, sub: 1, member: 1 });

  const b = probe({ member: { state: 'ok', member: true, roles: [], boosting: true } });
  assert.deepEqual(await checkGates(ALL, b, ctx), { pass: true, via: 'discord-booster' });
  assert.equal(b.calls.member, 1, 'memoised across the role and booster rules');
});

test('sub tiers: at or above passes, below says upgrade, none says subscribe', async () => {
  const g: EntryGates = { anyOf: [{ kind: 'twitch-sub', tier: 2 }] };
  assert.equal((await checkGates(g, probe({ sub: { state: 'ok', value: 3 } }), ctx)).pass, true);
  assert.equal((await checkGates(g, probe({ sub: { state: 'ok', value: 2 } }), ctx)).pass, true);
  const low = await checkGates(g, probe({ sub: { state: 'ok', value: 1 } }), ctx);
  assert.equal(low.pass, false);
  if (!low.pass) assert.deepEqual(low.steps, ['Upgrade your coolstreamer sub to tier 2']);
  const none = await checkGates(g, probe({ sub: { state: 'ok', value: 0 } }), ctx);
  if (!none.pass) assert.deepEqual(none.steps, ['Subscribe to coolstreamer on Twitch (tier 2 or higher)']);
});

test('a failure lists what to do, plainly, one line per fix', async () => {
  const v = await checkGates(ALL, probe({ member: { state: 'ok', member: true, roles: [], boosting: false } }), ctx);
  assert.equal(v.pass, false);
  if (v.pass) return;
  assert.equal(v.transient, false);
  assert.equal(v.linkTwitch, false);
  assert.deepEqual(v.steps, [
    'Follow coolstreamer on Twitch',
    'Subscribe to coolstreamer on Twitch (tier 2 or higher)',
    'Get the Subs role in Cool Streamer’s Discord server',
    'Boost Cool Streamer’s Discord server',
  ]);
  assert.equal(
    v.summary,
    'Open to followers of coolstreamer on Twitch, tier 2+ subscribers of coolstreamer on Twitch, people with the Subs role in Cool Streamer’s Discord server or boosters of Cool Streamer’s Discord server.',
  );
  assert.equal(verdictMessage(v), `${v.summary} Follow coolstreamer on Twitch, then try again.`);
});

test('not in the server: "join" once, not once per Discord rule', async () => {
  const v = await checkGates(ALL, probe({}), ctx);
  if (!v.pass) assert.deepEqual(v.steps.slice(2), ['Join Cool Streamer’s Discord server']);
});

test('an unlinked viewer is asked to link Twitch, and gets the button', async () => {
  const g: EntryGates = { anyOf: [{ kind: 'twitch-follow' }, { kind: 'twitch-sub', tier: 1 }] };
  const v = await checkGates(g, probe({ follows: { state: 'viewer-unlinked' }, sub: { state: 'viewer-unlinked' } }), ctx);
  assert.equal(v.pass, false);
  if (v.pass) return;
  assert.equal(v.linkTwitch, true);
  assert.deepEqual(v.steps, ['Link your Twitch account']);
  assert.equal(v.summary, 'Open to followers of coolstreamer on Twitch or subscribers of coolstreamer on Twitch.');
});

test('outages fail closed and are marked transient; a thrown probe counts as an outage', async () => {
  const g: EntryGates = { anyOf: [{ kind: 'twitch-follow' }, { kind: 'discord-booster' }] };
  const p: GateProbe = {
    twitchFollows: async () => ({ state: 'error' }),
    twitchSubTier: async () => ({ state: 'error' }),
    discordMember: async () => {
      throw new Error('boom');
    },
  };
  const v = await checkGates(g, p, ctx);
  assert.equal(v.pass, false);
  if (v.pass) return;
  assert.equal(v.transient, true);
  assert.equal(v.steps.length, 2);
  assert.ok(!verdictMessage(v).includes('then try again'));
});

test('host-side problems name whose move it is', async () => {
  const g: EntryGates = { anyOf: [{ kind: 'twitch-follow' }, { kind: 'discord-booster' }] };
  const v = await checkGates(g, probe({ follows: { state: 'host-missing' }, member: { state: 'no-server' } }), ctx);
  if (v.pass) return assert.fail('should not pass');
  assert.equal(v.transient, false);
  assert.deepEqual(v.steps, [
    'The host’s Twitch connection isn’t working — let them know',
    'The host’s Discord server isn’t connected — let them know',
  ]);
});

test('a spoken-for Twitch account is said as one sentence, with no "try again"', () => {
  const v = twitchAlreadyUsed('Open to followers of x on Twitch.');
  assert.equal(v.blocked, true);
  assert.equal(verdictMessage(v), 'That Twitch account was already used to join this event by another player.');
});

test('labels without a connected channel still read', () => {
  assert.equal(gatesSummary({ anyOf: [{ kind: 'twitch-follow' }] }, { twitchLogin: null, hostName: 'X' }), 'Open to followers of the host on Twitch.');
});

test('short labels: a few words per gate for the plugin panel', async () => {
  const { gatesShortLabel, ruleShortLabel } = await import('../src/lib/entryGates.ts');
  const g = (anyOf: unknown[]) => parseGates({ anyOf });
  assert.equal(gatesShortLabel(null), null);
  assert.equal(gatesShortLabel(g([{ kind: 'twitch-sub', tier: 1 }])), 'Subs only (Twitch)');
  assert.equal(gatesShortLabel(g([{ kind: 'twitch-sub', tier: 2 }])), 'Tier 2+ subs (Twitch)');
  assert.equal(gatesShortLabel(g([{ kind: 'kick-follow' }])), 'Followers (Kick)');
  assert.equal(gatesShortLabel(g([{ kind: 'kick-sub' }])), 'Subs only (Kick)');
  assert.equal(gatesShortLabel(g([{ kind: 'discord-booster' }])), 'Boosters');
  assert.equal(gatesShortLabel(g([{ kind: 'discord-role', roleId: '123456789012345678', roleName: '@Raiders' }])), 'Discord role: Raiders');
  assert.equal(gatesShortLabel(g([{ kind: 'twitch-follow' }, { kind: 'discord-booster' }])), 'Followers (Twitch) or Boosters');
  assert.equal(
    gatesShortLabel(g([{ kind: 'twitch-follow' }, { kind: 'twitch-sub', tier: 1 }, { kind: 'discord-booster' }, { kind: 'youtube-sub' }, { kind: 'kick-follow' }])),
    'Followers (Twitch), Subs (Twitch), Boosters +2 more',
  );
  assert.equal(ruleShortLabel({ kind: 'youtube-member' }), 'Members (YouTube)');
  // A role name is display text that came from Discord: control characters gone, and bounded.
  const evil = gatesShortLabel(g([{ kind: 'discord-role', roleId: '123456789012345678', roleName: 'a\u0000b'.padEnd(90, 'x') }]))!;
  assert.ok(!/[\u0000-\u001f]/.test(evil));
  assert.ok(evil.length <= 'Discord role: '.length + 32);
});

// ── Readers ──────────────────────────────────────────────────────────────────────────────────────

test('twitch tiers and Discord member facts', () => {
  assert.equal(twitchTierOf('1000'), 1);
  assert.equal(twitchTierOf('2000'), 2);
  assert.equal(twitchTierOf('3000'), 3);
  assert.equal(twitchTierOf(null), 0);
  assert.equal(twitchTierOf('nonsense'), 0);
  assert.deepEqual(discordMemberFacts({ roles: [ROLE, 5], premium_since: '2026-01-01T00:00:00Z' }), { roles: [ROLE], boosting: true });
  assert.deepEqual(discordMemberFacts({ roles: 'x', premium_since: null }), { roles: [], boosting: false });
  assert.deepEqual(discordMemberFacts(null), { roles: [], boosting: false });
});

// ── validateGatesFor ─────────────────────────────────────────────────────────────────────────────

const OPTS: GateOptions = {
  twitch: { configured: true, channel: { login: 'coolstreamer', canHaveSubs: true, broken: false }, connectUrl: '/x' },
  discord: { connected: true, roles: [{ id: ROLE, name: 'Subs' }] },
};

test('a host can only save gates they can actually check', () => {
  assert.deepEqual(validateGatesFor(null, OPTS), { ok: true });
  assert.deepEqual(validateGatesFor(ALL, OPTS), { ok: true });
  const off = { ...OPTS, twitch: { configured: false, channel: null, connectUrl: null } };
  assert.equal(validateGatesFor({ anyOf: [{ kind: 'twitch-follow' }] }, off).ok, false);
  const broken = { ...OPTS, twitch: { ...OPTS.twitch, channel: { login: 'a', canHaveSubs: true, broken: true } } };
  assert.equal(validateGatesFor({ anyOf: [{ kind: 'twitch-follow' }] }, broken).ok, false);
  const notAffiliate = { ...OPTS, twitch: { ...OPTS.twitch, channel: { login: 'a', canHaveSubs: false, broken: false } } };
  assert.equal(validateGatesFor({ anyOf: [{ kind: 'twitch-follow' }] }, notAffiliate).ok, true);
  assert.equal(validateGatesFor({ anyOf: [{ kind: 'twitch-sub', tier: 1 }] }, notAffiliate).ok, false);
  const noDiscord = { ...OPTS, discord: { connected: false, roles: [] } };
  assert.equal(validateGatesFor({ anyOf: [{ kind: 'discord-booster' }] }, noDiscord).ok, false);
  assert.equal(validateGatesFor({ anyOf: [{ kind: 'discord-role', roleId: '999999999999999999', roleName: 'x' }] }, OPTS).ok, false);
});

// ── GateCache ────────────────────────────────────────────────────────────────────────────────────

test('cache: a pass lasts ten minutes, a no a few seconds, an outage not at all', () => {
  const c = new GateCache();
  const g: EntryGates = { anyOf: [{ kind: 'twitch-follow' }] };
  const k = GateCache.key(1, 2, g);
  c.set(k, { pass: true, via: 'twitch-follow' }, 0);
  assert.ok(c.get(k, GATE_PASS_TTL_MS - 1));
  assert.equal(c.get(k, GATE_PASS_TTL_MS), null);

  const no = { pass: false as const, transient: false, summary: '', steps: [], linkTwitch: false };
  c.set(k, no, 0);
  assert.ok(c.get(k, GATE_FAIL_TTL_MS - 1));
  assert.equal(c.get(k, GATE_FAIL_TTL_MS), null);

  c.set(k, { ...no, transient: true }, 0);
  assert.equal(c.get(k, 1), null);
});

test('cache: changing the gates is a different key; forgetting a user clears only theirs', () => {
  const c = new GateCache();
  const a: EntryGates = { anyOf: [{ kind: 'twitch-follow' }] };
  const b: EntryGates = { anyOf: [{ kind: 'discord-booster' }] };
  assert.notEqual(GateCache.key(1, 2, a), GateCache.key(1, 2, b));
  c.set(GateCache.key(1, 2, a), { pass: true, via: 'twitch-follow' });
  c.set(GateCache.key(11, 2, a), { pass: true, via: 'twitch-follow' });
  c.forgetUser(1);
  assert.equal(c.get(GateCache.key(1, 2, a)), null);
  assert.ok(c.get(GateCache.key(11, 2, a)), 'user 11 is not user 1');
});

test('cache is bounded', () => {
  const c = new GateCache(3);
  const g: EntryGates = { anyOf: [{ kind: 'twitch-follow' }] };
  for (let i = 0; i < 10; i++) c.set(GateCache.key(i, 1, g), { pass: true, via: 'twitch-follow' });
  assert.equal(c.size, 3);
  assert.equal(c.get(GateCache.key(0, 1, g)), null);
  assert.ok(c.get(GateCache.key(9, 1, g)));
});

// ── lib/twitch ───────────────────────────────────────────────────────────────────────────────────

const KEY = 'k'.repeat(40);
const CFG: TwitchConfig = { clientId: 'cid', clientSecret: 'secret', redirectUri: 'https://anvil.test/api/auth/twitch/callback', tokenKey: KEY };

test('twitchConfig needs all four values and a long enough key — otherwise Twitch is hidden', () => {
  const env = { TWITCH_CLIENT_ID: 'a', TWITCH_CLIENT_SECRET: 'b', TWITCH_REDIRECT_URI: 'https://x/cb', TWITCH_TOKEN_KEY: KEY };
  assert.ok(twitchConfig(env));
  assert.equal(twitchConfig({ ...env, TWITCH_CLIENT_SECRET: '' }), null);
  assert.equal(twitchConfig({ ...env, TWITCH_TOKEN_KEY: 'short' }), null);
  assert.equal(twitchConfig({}), null);
});

function state(over: Partial<TwitchState> = {}): TwitchState {
  return { u: 7, m: 'viewer', c: null, r: '/c/x/events/1', h: null, n: 'n'.repeat(24), e: Date.now() + 60_000, ...over };
}

test('state: signed, expiring, and tamper-evident', () => {
  const s = signState(state(), KEY);
  assert.equal(verifyState(s, KEY)?.u, 7);
  assert.equal(verifyState(s, 'x'.repeat(40)), null, 'another key');
  const [body, mac] = s.split('.');
  const forged = Buffer.from(JSON.stringify({ ...state(), u: 8 })).toString('base64url');
  assert.equal(verifyState(`${forged}.${mac}`, KEY), null, 'payload swapped');
  assert.equal(verifyState(`${body}.AAAA`, KEY), null, 'short mac does not throw');
  assert.equal(verifyState(signState(state({ e: Date.now() - 1 }), KEY), KEY), null, 'expired');
  assert.equal(verifyState(signState(state({ m: 'host', c: null }), KEY), KEY), null, 'host needs a space');
  assert.equal(verifyState(signState(state({ n: 'short' }), KEY), KEY), null);
  assert.equal(verifyState('garbage', KEY), null);
  assert.equal(verifyState(null, KEY), null);
});

test('authorize URL: a viewer grants no scopes, the host grants the two reads', () => {
  const v = new URL(authorizeUrl(CFG, 'viewer', 'st'));
  assert.equal(v.searchParams.get('scope'), '');
  assert.equal(v.searchParams.get('state'), 'st');
  assert.equal(v.searchParams.get('redirect_uri'), CFG.redirectUri);
  const h = new URL(authorizeUrl(CFG, 'host', 'st'));
  assert.equal(h.searchParams.get('scope'), HOST_SCOPES.join(' '));
  assert.equal(h.searchParams.get('force_verify'), 'true');
  assert.equal(hasHostScopes([...HOST_SCOPES]), true);
  assert.equal(hasHostScopes(['channel:read:subscriptions']), false);
});

/** A fetch that answers from a table of (method path) → response, and records every call. */
function mockFetch(routes: Record<string, () => Response>): FetchLike & { calls: string[] } {
  const calls: string[] = [];
  const f = (async (input: string, init?: RequestInit) => {
    const u = new URL(input);
    const key = `${init?.method ?? 'GET'} ${u.origin}${u.pathname}`;
    calls.push(`${key}${u.search}`);
    const r = routes[key];
    if (!r) throw new Error(`unexpected ${key}`);
    return r();
  }) as FetchLike & { calls: string[] };
  f.calls = calls;
  return f;
}

const json = (body: unknown, status = 200) => () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('code exchange and the user lookup', async () => {
  const f = mockFetch({
    'POST https://id.twitch.tv/oauth2/token': json({ access_token: 'at', refresh_token: 'rt', expires_in: 100, scope: ['a'] }),
    'GET https://api.twitch.tv/helix/users': json({ data: [{ id: '42', login: 'CoolStreamer', broadcaster_type: 'affiliate' }] }),
  });
  assert.deepEqual(await exchangeCode(CFG, 'code', f), { accessToken: 'at', refreshToken: 'rt', expiresIn: 100, scope: ['a'] });
  assert.deepEqual(await fetchUser(CFG, 'at', f), { id: '42', login: 'coolstreamer', broadcasterType: 'affiliate' });

  const odd = mockFetch({ 'GET https://api.twitch.tv/helix/users': json({ data: [{ id: 'x"><', login: 'a' }] }) });
  await assert.rejects(fetchUser(CFG, 'at', odd));
});

test('a refused refresh is distinguishable from an outage', async () => {
  const refused = mockFetch({ 'POST https://id.twitch.tv/oauth2/token': json({ message: 'Invalid refresh token' }, 400) });
  await assert.rejects(refreshToken(CFG, 'rt', refused), (e: unknown) => e instanceof TwitchAuthError && e.refused);
  const down = mockFetch({ 'POST https://id.twitch.tv/oauth2/token': json({}, 503) });
  await assert.rejects(refreshToken(CFG, 'rt', down), (e: unknown) => e instanceof TwitchAuthError && !e.refused);
});

test('follower and subscription reads', async () => {
  const f = mockFetch({
    'GET https://api.twitch.tv/helix/channels/followers': json({ data: [{ user_id: '9', user_login: 'v' }], total: 1 }),
    'GET https://api.twitch.tv/helix/subscriptions': json({ data: [{ user_id: '9', tier: '2000' }] }),
  });
  assert.deepEqual(await followsChannel(CFG, 'bt', '42', '9', f), { ok: true, value: true });
  assert.deepEqual(await subscriptionTier(CFG, 'bt', '42', '9', f), { ok: true, value: '2000' });
  assert.ok(f.calls[0].includes('broadcaster_id=42') && f.calls[0].includes('user_id=9'));

  const empty = mockFetch({
    'GET https://api.twitch.tv/helix/channels/followers': json({ data: [], total: 1000 }),
    'GET https://api.twitch.tv/helix/subscriptions': json({ data: [] }),
  });
  assert.deepEqual(await followsChannel(CFG, 'bt', '42', '9', empty), { ok: true, value: false });
  assert.deepEqual(await subscriptionTier(CFG, 'bt', '42', '9', empty), { ok: true, value: null });

  const unauthorized = mockFetch({ 'GET https://api.twitch.tv/helix/channels/followers': json({}, 401) });
  assert.deepEqual(await followsChannel(CFG, 'bt', '42', '9', unauthorized), { ok: false, reason: 'unauthorized' });
  const down = mockFetch({ 'GET https://api.twitch.tv/helix/subscriptions': json({}, 500) });
  assert.deepEqual(await subscriptionTier(CFG, 'bt', '42', '9', down), { ok: false, reason: 'error' });
  const thrown = (async () => {
    throw new Error('ECONNRESET');
  }) as FetchLike;
  assert.deepEqual(await followsChannel(CFG, 'bt', '42', '9', thrown), { ok: false, reason: 'error' });
});
