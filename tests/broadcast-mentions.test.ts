// A clan broadcast pings only the role picked in the form — nothing typed in the body ever pings
// (lib/broadcastMessages). No database.
//
// Run: npx tsx --test tests/broadcast-mentions.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildMessages } from '../src/lib/broadcastMessages.ts';

const GUILD = '111111111111111111';
const ROLE = '222222222222222222';
const typed = '@everyone @here <@&333333333333333333> <@444444444444444444> read this';

test('no role picked: typed @everyone/@here/role/user mentions never ping (text and embed)', () => {
  for (const asEmbed of [false, true]) {
    const msgs = buildMessages({ body: typed, asEmbed }, GUILD);
    assert.ok(msgs.length >= 1);
    for (const m of msgs) assert.deepEqual(m.allowed_mentions, { parse: [] }, `asEmbed=${asEmbed}`);
  }
});

test('a picked role pings once, on the first message only; the body still pings nothing else', () => {
  const long = `${typed}\n\n${'word '.repeat(900)}\n\n${typed}`;
  const msgs = buildMessages({ body: long, asEmbed: false, mentionRoleId: ROLE }, GUILD);
  assert.ok(msgs.length > 1, 'split across messages');
  assert.deepEqual(msgs[0].allowed_mentions, { parse: [], roles: [ROLE] });
  assert.match(String(msgs[0].content), new RegExp(`^<@&${ROLE}>`));
  for (const m of msgs.slice(1)) assert.deepEqual(m.allowed_mentions, { parse: [] });

  const emb = buildMessages({ body: typed, asEmbed: true, mentionRoleId: ROLE }, GUILD);
  assert.deepEqual(emb[0].allowed_mentions, { parse: [], roles: [ROLE] });
});

test('@everyone picked in the form is the only way to ping everyone', () => {
  const msgs = buildMessages({ body: 'hi', asEmbed: false, mentionRoleId: GUILD }, GUILD);
  assert.deepEqual(msgs[0].allowed_mentions, { parse: ['everyone'] });
  // A junk role id is ignored rather than pinged.
  const junk = buildMessages({ body: 'hi', asEmbed: false, mentionRoleId: '@everyone' }, GUILD);
  assert.deepEqual(junk[0].allowed_mentions, { parse: [] });
});
