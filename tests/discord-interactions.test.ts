// Discord slash commands — the parts that must be right before anything reaches a member:
// signature verification (the endpoint's only authentication), payload parsing, the guild guard
// that keeps one clan's board out of another clan's Discord, and the command tree Discord will
// refuse to register if it's malformed.
//
// Run: DATABASE_URL=file:./.test-discord.db npx tsx --test tests/discord-interactions.test.ts
// (tsx for the `@/` alias; a DATABASE_URL because lib/discordContext imports `@/db`, which refuses
// to load without one. Nothing here queries it — the functions under test are pure.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';

import {
  OPTION_TYPE,
  CALLBACK_TYPE,
  MESSAGE_FLAGS,
  deferred,
  embedReply,
  invokerId,
  invokerName,
  pong,
  readSubcommand,
  textReply,
  verifyDiscordSignature,
  type Interaction,
} from '../src/lib/discordInteractions.ts';
import { COMMAND_DEFINITIONS, COMMAND_NAME } from '../src/lib/discordCommandDefs.ts';
import { checkGuild, contextLine, type ClanContext, type EventContext, type CrossClanContext } from '../src/lib/discordContext.ts';

// ── Signature verification ──────────────────────────────────────────────────────────────────────

/** A throwaway Ed25519 app identity, in the hex shape Discord publishes as `verify_key`. */
function fakeApp() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);
  return {
    publicKeyHex: Buffer.from(raw).toString('hex'),
    signFor(timestamp: string, body: string): string {
      return sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
    },
  };
}

test('verifyDiscordSignature: accepts a genuine signature over timestamp + raw body', async () => {
  const app = fakeApp();
  const timestamp = '1700000000';
  const rawBody = JSON.stringify({ type: 1 });
  assert.equal(
    await verifyDiscordSignature({
      publicKeyHex: app.publicKeyHex,
      signature: app.signFor(timestamp, rawBody),
      timestamp,
      rawBody,
    }),
    true,
  );
});

test('verifyDiscordSignature: rejects a tampered body, timestamp, or signature', async () => {
  const app = fakeApp();
  const timestamp = '1700000000';
  const rawBody = JSON.stringify({ type: 2, data: { name: 'bingo' } });
  const signature = app.signFor(timestamp, rawBody);

  // Replaying a valid signature over different content is THE attack this stops.
  assert.equal(
    await verifyDiscordSignature({ publicKeyHex: app.publicKeyHex, signature, timestamp, rawBody: '{"type":2}' }),
    false,
  );
  // Re-serialized JSON (same data, different bytes) must fail too — which is why the route verifies
  // the raw body and never JSON.parse → JSON.stringify first.
  assert.equal(
    await verifyDiscordSignature({
      publicKeyHex: app.publicKeyHex,
      signature,
      timestamp,
      rawBody: JSON.stringify(JSON.parse(rawBody), null, 2),
    }),
    false,
  );
  assert.equal(
    await verifyDiscordSignature({ publicKeyHex: app.publicKeyHex, signature, timestamp: '1700000001', rawBody }),
    false,
  );
  assert.equal(
    await verifyDiscordSignature({ publicKeyHex: app.publicKeyHex, signature: 'ff'.repeat(64), timestamp, rawBody }),
    false,
  );
});

test('verifyDiscordSignature: rejects malformed input instead of throwing', async () => {
  const app = fakeApp();
  const cases = [
    { signature: null, timestamp: '1', rawBody: '{}' },
    { signature: 'abc', timestamp: null, rawBody: '{}' },
    { signature: 'not-hex-at-all', timestamp: '1', rawBody: '{}' },
    { signature: 'aa', timestamp: '1', rawBody: '{}' }, // right charset, wrong length
  ];
  for (const c of cases) {
    assert.equal(await verifyDiscordSignature({ publicKeyHex: app.publicKeyHex, ...c }), false);
  }
  // A junk public key is a configuration error, not a crash.
  assert.equal(
    await verifyDiscordSignature({ publicKeyHex: 'zzzz', signature: 'aa'.repeat(64), timestamp: '1', rawBody: '{}' }),
    false,
  );
});

// ── Payload parsing ─────────────────────────────────────────────────────────────────────────────

function interaction(partial: Partial<Interaction>): Interaction {
  return { id: '1', type: 2, application_id: 'app', token: 'tok', ...partial } as Interaction;
}

test('readSubcommand: flattens /bingo team name:Reds share:true', () => {
  const { sub, options } = readSubcommand(
    interaction({
      data: {
        id: 'c',
        name: 'bingo',
        options: [
          {
            name: 'team',
            type: OPTION_TYPE.SUB_COMMAND,
            options: [
              { name: 'name', type: OPTION_TYPE.STRING, value: 'Reds' },
              { name: 'share', type: OPTION_TYPE.BOOLEAN, value: true },
            ],
          },
        ],
      },
    }),
  );
  assert.equal(sub, 'team');
  assert.deepEqual(options, { name: 'Reds', share: true });
});

test('readSubcommand: a subcommand with no arguments yields no options', () => {
  const { sub, options } = readSubcommand(
    interaction({ data: { id: 'c', name: 'bingo', options: [{ name: 'board', type: OPTION_TYPE.SUB_COMMAND }] } }),
  );
  assert.equal(sub, 'board');
  assert.deepEqual(options, {});
});

test('invokerId / invokerName: read from member in a guild and user in a DM', () => {
  const guild = interaction({ member: { user: { id: '42', username: 'ahmed', global_name: 'Ahmed' }, nick: 'Zezima' } });
  assert.equal(invokerId(guild), '42');
  // Server nickname wins — it's what everyone else in that channel sees them called.
  assert.equal(invokerName(guild), 'Zezima');

  const dm = interaction({ user: { id: '7', username: 'someone', global_name: null } });
  assert.equal(invokerId(dm), '7');
  assert.equal(invokerName(dm), 'someone');
  assert.equal(invokerId(interaction({})), null);
});

// ── Response envelopes ──────────────────────────────────────────────────────────────────────────

test('responses: default to ephemeral, and share:true opts into a visible post', () => {
  assert.equal(pong().type, CALLBACK_TYPE.PONG);
  assert.equal(textReply('hi').data?.flags, MESSAGE_FLAGS.EPHEMERAL);
  assert.equal(deferred().data?.flags, MESSAGE_FLAGS.EPHEMERAL);
  assert.equal(embedReply([{ title: 'x' }]).data?.flags, MESSAGE_FLAGS.EPHEMERAL);
  assert.equal(embedReply([{ title: 'x' }], { ephemeral: false }).data?.flags, undefined);
});

test('embedReply: stamps the Anvil brand at the response choke point', () => {
  const [embed] = embedReply([{ title: 'Standings' }]).data?.embeds as { footer?: { text: string } }[];
  assert.equal(embed.footer?.text, 'Powered by Anvil');
});

// ── Command tree ────────────────────────────────────────────────────────────────────────────────

test('COMMAND_DEFINITIONS: satisfies the constraints Discord enforces at registration', () => {
  // Discord rejects the whole PUT on any of these, and a rejected registration is a silent bot.
  const NAME_RE = /^[-_a-z0-9]{1,32}$/;
  for (const command of COMMAND_DEFINITIONS) {
    assert.ok(NAME_RE.test(command.name), `command name: ${command.name}`);
    assert.ok(command.description.length >= 1 && command.description.length <= 100, command.name);
    const subs = command.options ?? [];
    assert.ok(subs.length <= 25, 'at most 25 options per command');
    for (const sub of subs) {
      assert.ok(NAME_RE.test(sub.name), `subcommand name: ${sub.name}`);
      assert.ok(sub.description.length >= 1 && sub.description.length <= 100, sub.name);
      for (const opt of (sub as { options?: readonly { name: string; description: string }[] }).options ?? []) {
        assert.ok(NAME_RE.test(opt.name), `option name: ${opt.name}`);
        assert.ok(opt.description.length >= 1 && opt.description.length <= 100, opt.name);
      }
    }
  }
});

test('COMMAND_DEFINITIONS: every subcommand the tree advertises is one the dispatcher answers', async () => {
  // A command that autocompletes and then fails is worse than one that never existed, so the two
  // lists are asserted equal rather than one being a subset.
  const advertised = (COMMAND_DEFINITIONS.find((c) => c.name === COMMAND_NAME)?.options ?? []).map((o) => o.name);
  const { SUBCOMMAND_NAMES } = await import('../src/lib/discordCommands.ts');
  assert.deepEqual([...advertised].sort(), [...SUBCOMMAND_NAMES].sort());
});

// ── Guild guard + provenance ────────────────────────────────────────────────────────────────────

const clan: ClanContext = { name: 'The Afk Spot', origin: 'https://afk.example', guildId: '111', federated: true };

test('checkGuild: only this clan\'s own server is served', () => {
  assert.equal(checkGuild(clan, '111'), 'ok');
  // The whole point: the shared bot is in many servers, and being installed somewhere is not the
  // same as being that clan.
  assert.equal(checkGuild(clan, '222'), 'wrong-guild');
  assert.equal(checkGuild(clan, undefined), 'dm');
  // A clan that never connected a server has nothing to contradict, so commands still work.
  assert.equal(checkGuild({ ...clan, guildId: '' }, '222'), 'ok');
});

const event: EventContext = {
  id: 3,
  name: 'Summer Bingo',
  phase: 'running',
  format: 'bingo',
  scoringMode: 'points',
  boardSize: 5,
  rules: null,
  startDate: null,
  endDate: null,
  tilesRevealed: true,
  teamCount: 4,
  playerCount: 40,
};

const noVisitors: CrossClanContext = {
  shared: false,
  visitingPlayers: 0,
  visitingTeamIds: new Set(),
  visitingTeamNames: [],
};

test('contextLine: names the clan and the board so a screenshot is never ambiguous', () => {
  const line = contextLine(clan, event, noVisitors);
  assert.ok(line.startsWith('-# '), 'renders as Discord subtext');
  assert.ok(line.includes('The Afk Spot'));
  assert.ok(line.includes('Summer Bingo'));
  assert.ok(line.includes('running'));
});

test('contextLine: says so when other clans are in the event', () => {
  const players = contextLine(clan, event, { ...noVisitors, shared: true, visitingPlayers: 6 });
  assert.ok(players.includes('6 visiting players'));

  const wholeTeams = contextLine(clan, event, {
    shared: true,
    visitingPlayers: 10,
    visitingTeamIds: new Set([1, 2]),
    visitingTeamNames: ['Ironforge', 'Nightfall'],
  });
  // A whole visiting team is a stronger statement than a headcount — it means this is a clan-v-clan
  // board, not a few guests.
  assert.ok(wholeTeams.includes('cross-clan'));
  assert.ok(wholeTeams.includes('2 visiting teams'));
});

// ── Cross-repo drift ────────────────────────────────────────────────────────────────────────────

test('the control plane\'s copy of the command tree matches this one', async (t) => {
  // The shared Anvil application's commands are registered by Anvil.Admin (it holds the shared bot
  // token), so the tree is duplicated there — two separately deployed apps with no shared package.
  // Duplication that nothing checks is duplication that drifts: add a subcommand here and the
  // managed clans would advertise the old set forever.
  //
  // Skipped when the sibling repo isn't checked out (CI builds one repo at a time). That makes this
  // a developer-machine guard rather than a gate, which is where the drift gets introduced anyway.
  const fs = await import('node:fs');
  const path = new URL('../../Anvil.Admin/src/lib/discordCommandSync.ts', import.meta.url);
  if (!fs.existsSync(path)) return t.skip('Anvil.Admin not checked out alongside');

  const source = fs.readFileSync(path, 'utf8');
  const ours = COMMAND_DEFINITIONS.find((c) => c.name === COMMAND_NAME)!;

  // Compare the shape that matters to a member: the command name, and its subcommand names in order.
  assert.ok(source.includes(`name: '${ours.name}'`), 'control plane registers a different command name');
  // Tolerant of formatting: a subcommand may be written on one line or spread over several.
  const theirSubs = [...source.matchAll(/name: '([a-z]+)',\s*description:/g)].map((m) => m[1]);
  const ourSubs = (ours.options ?? []).map((o) => o.name);
  for (const sub of ourSubs) {
    assert.ok(theirSubs.includes(sub), `Anvil.Admin is missing /${COMMAND_NAME} ${sub} — update its SHARED_COMMANDS`);
  }
});
