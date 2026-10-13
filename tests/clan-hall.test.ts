// The clan hall: Discord's widget parsed, matched to the roster, merged with plugin presence, and
// rendered for other sites.
//
// Pure: lib/discordWidget, lib/clanHallMerge and lib/discordEmbedRender import no database.
//
// Run: npm run test:clanhall

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { inviteCode, isSnowflake, parseWidget, type GuildWidget } from '../src/lib/discordWidget';
import { mergeClanHall, nameCandidates, IN_GAME_WINDOW_MS, type HallRosterEntry } from '../src/lib/clanHallMerge';
import { escapeHtml, renderBadgeSvg, renderEmbedHtml } from '../src/lib/discordEmbedRender';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

// The shape Discord sends (trimmed from The AFK Spot's real widget).
const RAW = {
  id: '1324522160315961365',
  name: 'The AFK Spot',
  instant_invite: null,
  presence_count: 5,
  channels: [
    { id: '2', name: 'pvm-chillout', position: 2 },
    { id: '1', name: 'General', position: 1 },
  ],
  members: [
    { id: '0', username: 'Iron Kroft', status: 'online', avatar_url: 'https://cdn.discordapp.com/widget-avatars/a', channel_id: '2' },
    { id: '1', username: 'Mossy_Rocks / Mossy Alt', status: 'idle', avatar_url: 'https://evil.example/x.png', game: { name: 'RuneLite' } },
    { id: '2', username: '[AFK] Lil Tbow', status: 'dnd', channel_id: '2' },
    { id: '3', username: 'xX_chillguy', status: 'idle' },
    { id: '4', username: 'Zulrah Dad', status: 'weird', game: { name: 'Once Human' } },
    { id: '5', status: 'online' },
  ],
};

function widget(): GuildWidget {
  const w = parseWidget('1324522160315961365', RAW);
  assert.ok(w);
  return w;
}

const ROSTER: HallRosterEntry[] = [
  { accountId: 1, rsn: 'Iron Kroft', rank: 'Owner', liveStatsAt: null },
  { accountId: 2, rsn: 'Mossy Rocks', rank: 'General', liveStatsAt: null },
  { accountId: 3, rsn: 'Lil Tbow', rank: null, liveStatsAt: ago(60_000) },
  { accountId: 4, rsn: 'Zulrah Dad', rank: null, liveStatsAt: ago(IN_GAME_WINDOW_MS + 60_000) },
  // Playing with the plugin, not on Discord at all.
  { accountId: 5, rsn: 'Hc Peanut', rank: null, liveStatsAt: ago(30_000) },
];

test('parse: drops nameless members, keeps only Discord CDN avatars, sorts channels', () => {
  const w = widget();
  assert.equal(w.members.length, 5);
  assert.equal(w.members[1].avatarUrl, null, 'a non-Discord avatar URL never reaches an <img>');
  assert.equal(w.members[0].avatarUrl, 'https://cdn.discordapp.com/widget-avatars/a');
  assert.equal(w.members[4].status, 'online', 'an unknown status reads as online');
  assert.deepEqual(w.channels.map((c) => c.name), ['General', 'pvm-chillout']);
  assert.equal(parseWidget('1', { nope: true }), null);
});

test('guild ids are snowflakes only', () => {
  assert.ok(isSnowflake('1324522160315961365'));
  assert.ok(!isSnowflake('../../users/@me'));
  assert.ok(!isSnowflake(''));
  assert.ok(!isSnowflake(null));
});

test('name candidates: nickname-sync "A / B", tags and underscores', () => {
  assert.deepEqual(nameCandidates('Mossy_Rocks / Mossy Alt').slice(0, 2), ['mossy rocks', 'mossy alt']);
  assert.ok(nameCandidates('[AFK] Lil Tbow').includes('lil tbow'));
  assert.ok(nameCandidates('Name | PvM').includes('name'));
});

test('merge: matches, counts in game once, and adds plugin-only players', () => {
  const hall = mergeClanHall({
    widget: widget(),
    roster: ROSTER,
    weekXp: new Map([[2, 1_800_000]]),
    teamByAccount: new Map([[1, { id: 9, name: 'Iron Wolves', color: '#f00' }], [3, { id: 9, name: 'Iron Wolves', color: '#f00' }]]),
    inviteUrl: 'https://discord.gg/abc',
    includeNames: true,
    now: NOW,
  });
  const by = new Map(hall.people!.map((p) => [p.rsn ?? p.name, p]));

  assert.equal(by.get('Mossy Rocks')?.rank, 'General');
  assert.equal(by.get('Mossy Rocks')?.inGame, true, 'RuneLite activity counts as in game');
  assert.deepEqual(by.get('Mossy Rocks')?.doing, { kind: 'xp', xp: 1_800_000 });
  assert.equal(by.get('Lil Tbow')?.inGame, true, 'a fresh plugin push counts as in game');
  assert.equal(by.get('Zulrah Dad')?.inGame, false, 'a stale push and a non-OSRS game do not');
  assert.deepEqual(by.get('xX_chillguy')?.doing, { kind: 'unlinked' });
  assert.equal(by.get('Hc Peanut')?.status, null, 'in game without Discord still shows');

  // Mossy (RuneLite) + Lil Tbow (plugin) + Hc Peanut (plugin only) — each counted once.
  assert.equal(hall.counts.inGame, 3);
  assert.equal(hall.counts.voice, 2);
  assert.equal(hall.counts.discord, 5);

  assert.equal(hall.rooms.length, 1);
  assert.equal(hall.rooms[0].name, 'pvm-chillout');
  assert.equal(hall.rooms[0].teamNote, 'Iron Wolves, 2 of 2');
  assert.deepEqual(hall.emptyRooms, ['General']);
  assert.equal(hall.guild?.inviteUrl, 'https://discord.gg/abc', 'falls back to the clan invite');

  // Voice first, then in game.
  assert.ok(hall.people![0].voiceChannel);
});

test('merge without names keeps counts and room sizes, withholds who', () => {
  const hall = mergeClanHall({
    widget: widget(),
    roster: ROSTER,
    weekXp: new Map(),
    teamByAccount: new Map([[1, { id: 9, name: 'Iron Wolves', color: '#f00' }], [3, { id: 9, name: 'Iron Wolves', color: '#f00' }]]),
    inviteUrl: null,
    includeNames: false,
    now: NOW,
  });
  assert.equal(hall.people, null);
  assert.equal(hall.counts.inGame, 3);
  assert.equal(hall.rooms[0].people.length, 2);
  assert.ok(hall.rooms[0].people.every((p) => p.name === '' && p.rsn === null));
  assert.equal(hall.rooms[0].teamNote, null, 'a team name would say who is in the room');
});

test('one roster account is matched to one Discord member', () => {
  const w = widget();
  w.members.push({ id: '9', username: 'Iron Kroft', status: 'online', avatarUrl: null, game: null, channelId: null });
  const hall = mergeClanHall({ widget: w, roster: ROSTER, weekXp: new Map(), teamByAccount: new Map(), inviteUrl: null, includeNames: true, now: NOW });
  assert.equal(hall.people!.filter((p) => p.rsn === 'Iron Kroft').length, 1);
});

test('embed and badge escape everything they print', () => {
  assert.equal(escapeHtml('<a href="x">&\''), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
  const html = renderEmbedHtml({
    clan: { name: '<script>alert(1)</script>', slug: 's', logoUrl: 'javascript:alert(1)', bannerUrl: 'https://media.example/b.webp', bannerPosition: 140 },
    counts: { discord: 37, inGame: 12, voice: 0 },
    clanUrl: 'https://anvilosrs.com/c/s',
    inviteUrl: null,
  });
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('javascript:'), 'a non-https logo is dropped');
  assert.ok(html.includes('object-position:50% 100%'), 'banner focus is clamped');
  assert.ok(!html.includes('class="join"'), 'no invite, no Join button');
  const svg = renderBadgeSvg('A & B <clan>', '37 on Discord');
  assert.ok(svg.includes('A &amp; B &lt;clan&gt;'));
  assert.ok(svg.startsWith('<svg'));
});

test('invite codes come only out of real Discord invite links', () => {
  assert.equal(inviteCode('https://discord.gg/p9NkrTQmxN'), 'p9NkrTQmxN');
  assert.equal(inviteCode('https://discord.com/invite/afkspot'), 'afkspot');
  assert.equal(inviteCode('https://evil.example/discord.gg/x'), null);
  assert.equal(inviteCode('http://discord.gg/abc'), null);
  assert.equal(inviteCode(null), null);
});
