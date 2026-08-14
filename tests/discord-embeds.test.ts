// Embed house style (lib/discordEmbeds) — the brand stamp applied at every send choke point, the
// field helpers, and the server-composed death / PvP-kill embed.
//
// Run: node --experimental-strip-types --test tests/discord-embeds.test.ts
// (lib/discordEmbeds imports nothing from `@/`, so Node's native TS type-stripping runs it directly.)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ANVIL_LOGO_URL,
  EMBED_COLOR,
  POWERED_BY,
  clamp,
  clipEmbed,
  code,
  field,
  playerEventEmbed,
  stampBrand,
  stampEmbeds,
  statField,
  teamColorToDecimal,
} from '../src/lib/discordEmbeds.ts';

test('stampBrand: adds the Anvil footer and a timestamp', () => {
  const stamped = stampBrand({ title: 'Hello' });
  assert.deepEqual(stamped.footer, { text: POWERED_BY, icon_url: ANVIL_LOGO_URL });
  assert.equal(typeof stamped.timestamp, 'string');
  // The footer never carries a URL: Discord renders no markdown there, so it would be dead text.
  assert.ok(!POWERED_BY.includes('http'));
});

test('stampBrand: keeps an explicit timestamp, replaces any other footer, does not mutate', () => {
  const original = { title: 'x', timestamp: '2026-01-01T00:00:00.000Z', footer: { text: 'Someone else' } };
  const stamped = stampBrand(original);
  assert.equal(stamped.timestamp, '2026-01-01T00:00:00.000Z');
  assert.equal(stamped.footer.text, POWERED_BY);
  assert.deepEqual(original.footer, { text: 'Someone else' }, 'input must not be mutated');
});

test('stampEmbeds: stamps every embed, leaves embed-less payloads alone', () => {
  const payload = { content: 'hi', embeds: [{ title: 'a' }, { title: 'b' }] };
  const out = stampEmbeds(payload);
  assert.equal(out.embeds.length, 2);
  for (const e of out.embeds) {
    assert.equal((e as { footer?: { text: string } }).footer?.text, POWERED_BY);
  }

  const plain: { content: string; embeds?: unknown } = { content: 'no embeds here' };
  assert.equal(stampEmbeds(plain), plain);
});

test('code: boxes a value and cannot break out of its span', () => {
  assert.equal(code(1234), '`1234`');
  assert.equal(code('a`b'), '`ab`');
});

test('field / statField: clamp to Discord limits, stat values are boxed', () => {
  assert.deepEqual(statField('KC', 612), { name: 'KC', value: '`612`', inline: true });
  assert.deepEqual(field('Note', 'spooned', false), { name: 'Note', value: 'spooned', inline: false });

  const long = 'x'.repeat(2000);
  assert.ok(field('Note', long, false).value.length <= 1024);
});

test('clamp: only truncates past the limit, and marks it', () => {
  assert.equal(clamp('short', 20), 'short');
  const out = clamp('y'.repeat(30), 10);
  assert.equal(out.length, 10);
  assert.ok(out.endsWith('…'));
});

test('teamColorToDecimal: parses hex, falls back to Anvil gold on junk', () => {
  assert.equal(teamColorToDecimal('#3b82f6'), 0x3b82f6);
  assert.equal(teamColorToDecimal('3b82f6'), 0x3b82f6);
  assert.equal(teamColorToDecimal(''), EMBED_COLOR.gold);
  assert.equal(teamColorToDecimal(null), EMBED_COLOR.gold);
  assert.equal(teamColorToDecimal('not-a-colour'), EMBED_COLOR.gold);
});

test('playerEventEmbed: a death carries the RSN, the plugin wording, and the screenshot inline', () => {
  const embed = playerEventEmbed({
    kind: 'death',
    rsn: 'Bagerz',
    message: '**Bagerz** just died!\nSkill issue, honestly.',
    imageFilename: 'anvil-death.png',
  });
  assert.equal(embed.author?.name, 'Bagerz');
  assert.equal(embed.color, EMBED_COLOR.red);
  assert.equal(embed.title, '💀 Death');
  // The clan's own death line is carried verbatim rather than re-worded server-side.
  assert.ok(embed.description?.includes('Skill issue, honestly.'));
  assert.deepEqual(embed.image, { url: 'attachment://anvil-death.png' });
});

test('playerEventEmbed: a PvP kill is gold, and an unknown RSN simply drops the author line', () => {
  const embed = playerEventEmbed({ kind: 'pvp_kill', rsn: null, message: 'X killed Y!' });
  assert.equal(embed.color, EMBED_COLOR.gold);
  assert.equal(embed.title, '⚔️ PvP kill');
  assert.equal(embed.author, undefined);
  assert.equal(embed.image, undefined);
});

// ---- Clip embed -----------------------------------------------------------------------
// A clip post's whole job is telling someone whether the video is worth opening. The failure
// mode is a generic title with the real information missing — which is what shipped, because
// the plugin only fed it a "moment" when the matching Discord channel happened to be enabled.

test('clipEmbed: the headline moment becomes the title', () => {
  const e = clipEmbed({
    rsn: 'Drenvox mdps',
    moment: '⚔️ Killed Molag\n💰 2.1M gp haul from Molag',
    eventName: 'Test missions bingo',
    seconds: 30,
  });
  assert.equal(e.title, '⚔️ Killed Molag');
  assert.equal(e.author?.name, 'Drenvox mdps');
  // Remaining moments stay in the body, newest-first order preserved.
  assert.ok(e.description!.startsWith('💰 2.1M gp haul from Molag'));
});

test('clipEmbed: no field rows — length and event ride the subtext line', () => {
  const e = clipEmbed({ rsn: 'x', moment: '⚔️ Killed Molag', eventName: 'Summer bingo', seconds: 30 });
  assert.equal(e.fields, undefined, 'a whole field row for "30s" was the emptiest thing in the post');
  assert.ok(e.description!.includes('-# Summer bingo · 30s'));
});

test('clipEmbed: falls back to naming the event when nothing notable happened', () => {
  const e = clipEmbed({ rsn: 'x', moment: null, eventName: 'Test missions bingo', seconds: 30 });
  assert.equal(e.title, '🎬 Clip saved');
  assert.ok(e.description!.includes('Clipped during Test missions bingo.'));
  // …and does not then repeat the event name in the subtext.
  assert.equal(e.description!.match(/Test missions bingo/g)!.length, 1);
});

test('clipEmbed: survives having nothing at all to say', () => {
  const e = clipEmbed({ rsn: null, moment: null, eventName: null, seconds: null });
  assert.equal(e.title, '🎬 Clip saved');
  assert.equal(e.author, undefined);
  assert.equal(e.description, undefined);
});

test('clipEmbed: a blank-but-present moment is treated as no moment', () => {
  const e = clipEmbed({ rsn: 'x', moment: '  \n \n', eventName: 'Bingo', seconds: 5 });
  assert.equal(e.title, '🎬 Clip saved');
  assert.ok(e.description!.includes('Clipped during Bingo.'));
});
