// Every slash command, every subcommand, run for real against a seeded clan — and every Share button
// it hands out, pressed.
//
// The unit tests covered the pieces (encoders, guards, dictionaries) and still let a /stats pbs Share
// ship that could never decode: the custom_id was built, clipped to 100 characters and only failed
// when someone pressed it. This walks the whole command tree the way Discord would drive it and
// holds every reply to Discord's own limits, so a reply Discord would reject — or a button that
// cannot come back — fails here instead of in a member's channel.
//
// Run: npx tsx --test tests/discord-command-sweep.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('discord-command-sweep');
const GUILD = 'guild-sweep';
const DISCORD_ID = '111111111111111111';

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let C: typeof import('../src/lib/discordCommands.ts');
let DEFS: typeof import('../src/lib/discordCommandDefs.ts');

type Opt = { name: string; type: number; value?: string | number | boolean; options?: Opt[] };

function interaction(name: string, options: Opt[], extra: Record<string, unknown> = {}) {
  return {
    id: 'i', type: 2, application_id: 'a', token: 't', guild_id: GUILD, locale: 'en-US', guild_locale: 'en-US',
    member: { user: { id: DISCORD_ID, username: 'sweeper', global_name: 'Sweeper' } },
    data: { id: 'd', name, options },
    ...extra,
  };
}

/** Discord's documented message limits — anything past these is a 400 on the response. */
function assertWithinDiscordLimits(label: string, res: { data?: Record<string, unknown> }) {
  const data = (res.data ?? {}) as {
    content?: string;
    embeds?: { title?: string; description?: string; fields?: { name: string; value: string }[]; footer?: { text?: string }; author?: { name?: string } }[];
    components?: { components?: { custom_id?: string; label?: string }[] }[];
  };
  if (data.content) assert.ok(data.content.length <= 2000, `${label}: content ${data.content.length} > 2000`);
  const embeds = data.embeds ?? [];
  assert.ok(embeds.length <= 10, `${label}: ${embeds.length} embeds`);
  let total = 0;
  for (const e of embeds) {
    if (e.title) { assert.ok(e.title.length <= 256, `${label}: title ${e.title.length}`); total += e.title.length; }
    if (e.description) { assert.ok(e.description.length <= 4096, `${label}: description ${e.description.length}`); total += e.description.length; }
    assert.ok((e.fields ?? []).length <= 25, `${label}: ${(e.fields ?? []).length} fields`);
    for (const f of e.fields ?? []) {
      assert.ok(f.name.length > 0 && f.name.length <= 256, `${label}: field name ${f.name.length}`);
      assert.ok(f.value.length > 0 && f.value.length <= 1024, `${label}: field "${f.name}" value ${f.value.length}`);
      total += f.name.length + f.value.length;
    }
    if (e.footer?.text) { assert.ok(e.footer.text.length <= 2048); total += e.footer.text.length; }
    if (e.author?.name) { assert.ok(e.author.name.length <= 256); total += e.author.name.length; }
  }
  assert.ok(total <= 6000, `${label}: embeds total ${total} > 6000`);
  for (const row of data.components ?? []) {
    for (const c of row.components ?? []) {
      if (c.custom_id != null) assert.ok(c.custom_id.length <= 100, `${label}: custom_id ${c.custom_id.length} > 100`);
    }
  }
}

function customIds(res: { data?: Record<string, unknown> }): string[] {
  const rows = ((res.data ?? {}) as { components?: { components?: { custom_id?: string }[] }[] }).components ?? [];
  return rows.flatMap((r) => (r.components ?? []).map((c) => c.custom_id).filter((x): x is string => !!x));
}

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  C = await import('../src/lib/discordCommands.ts');
  DEFS = await import('../src/lib/discordCommandDefs.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'sweep', name: 'The Sweep Spot', inGameName: 'Sweep' }).returning();
  await db.insert(s.settings).values({ clanId: clan.id, key: 'discord_guild_id', value: GUILD });
  await db.insert(s.settings).values({ clanId: clan.id, key: 'discord_guild_verified_id', value: GUILD });

  const [person] = await db.insert(s.players).values({ displayName: 'Drenvox mdps' }).returning();
  await db.insert(s.users).values({ displayName: 'Drenvox', discordId: DISCORD_ID, playerId: person.id });
  const [acct] = await db
    .insert(s.accounts)
    .values({ playerId: person.id, rsn: 'Drenvox mdps', rsnNormalized: 'drenvox mdps', claimedAt: new Date().toISOString(), verifiedAt: new Date().toISOString(), isPrimary: 1 })
    .returning();
  const [seat] = await db.insert(s.clanMemberships).values({ clanId: clan.id, accountId: acct.id, kind: 'member', source: 'roster', rank: 'general' }).returning();

  // The PB set from the screenshot that broke Share: one raid, every scale and both spellings of a mode.
  const pbs: [string, number][] = [
    ['tombs of amascut', 107000], ['tombs of amascut solo', 132600], ['tombs of amascut 2 players', 107000],
    ['tombs of amascut 8 players', 197200], ['tombs of amascut expert mode', 92600], ['tombs of amascut: expert mode', 104800],
    ['tombs of amascut expert mode solo', 131500], ['tombs of amascut expert mode 4 players', 96800],
    ['theatre of blood: hard mode', 190000], ['chambers of xeric: challenge mode 3 players', 210000], ['zulrah', 5400],
  ];
  await db.insert(s.memberPersonalBests).values(
    pbs.map(([activity, centis]) => ({ accountId: acct.id, activity, teamSize: 0, centis, achievedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),
  );

  // A live bingo with a team and some tiles, so /bingo has something to answer about.
  const start = new Date(Date.now() - 86_400_000).toISOString();
  const end = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const [event] = await db.insert(s.events).values({ clanId: clan.id, name: 'Autumn Bingo', boardSize: 3, startDate: start, endDate: end, tilesRevealed: 1 }).returning();
  const [team] = await db.insert(s.teams).values({ eventId: event.id, name: 'Reds', color: '#ff0000' }).returning();
  await db.insert(s.eventParticipants).values({ eventId: event.id, clanMemberId: seat.id, teamId: team.id, name: 'Drenvox mdps' });
  for (let i = 0; i < 9; i++) {
    await db.insert(s.tiles).values({ eventId: event.id, position: i, label: `Tile ${i}` });
  }
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

/** Option sets worth trying per option name — blank is always tried too. */
const SAMPLE: Record<string, (string | number | boolean)[]> = {
  page: ['Tombs of Amascut', 'zulrah', 'Tombs of Amascut: Expert Mode'],
  account: ['Drenvox mdps'],
  member: [DISCORD_ID],
  language: ['sv'],
  name: ['Reds'],
  mode: ['normal', 'entry', 'hard'],
  size: [1, 4],
  step: [2],
  topic: ['plugin'],
  metric: ['ehb'],
};

type Def = { name: string; type?: number; options?: Def[]; choices?: { value: string | number }[]; required?: boolean };

/** Every (command, subcommand?, options) to try: bare, then each option on its own. */
function cases(): { label: string; name: string; options: Opt[] }[] {
  const out: { label: string; name: string; options: Opt[] }[] = [];
  for (const cmd of DEFS.COMMAND_DEFINITIONS as unknown as Def[]) {
    const subs = (cmd.options ?? []).filter((o) => o.type === 1);
    const targets = subs.length ? subs.map((s) => ({ sub: s.name, opts: s.options ?? [] })) : [{ sub: null as string | null, opts: cmd.options ?? [] }];
    for (const { sub, opts } of targets) {
      // Writes move real state; they're covered by their own tests and need staff.
      if (cmd.name === 'coffer' && sub !== 'balance') continue;
      const required = opts.filter((o) => o.required).map((o) => ({ name: o.name, type: o.type!, value: (o.choices?.[0]?.value ?? SAMPLE[o.name]?.[0] ?? 'x') as string }));
      const variants: Opt[][] = [required];
      for (const o of opts) {
        if (o.required) continue;
        for (const v of o.choices?.map((c) => c.value) ?? SAMPLE[o.name] ?? []) {
          variants.push([...required, { name: o.name, type: o.type!, value: v }]);
        }
      }
      // Every optional option at once, longest sample each — the shape that broke Share, since a
      // custom_id only overflows when several long options ride together.
      const longest = (o: Def) => [...(o.choices?.map((c) => c.value) ?? SAMPLE[o.name] ?? [])].sort((a, b) => String(b).length - String(a).length)[0];
      const all = opts.filter((o) => !o.required && longest(o) != null).map((o) => ({ name: o.name, type: o.type!, value: longest(o) }));
      if (all.length > 1) variants.push([...required, ...all]);
      for (const v of variants) {
        const label = `/${cmd.name}${sub ? ` ${sub}` : ''} ${v.map((o) => `${o.name}:${o.value}`).join(' ')}`.trim();
        out.push({ label, name: cmd.name, options: sub ? [{ name: sub, type: 1, options: v }] : v });
      }
    }
  }
  return out;
}

test('every command answers within Discord limits, and every Share button decodes', async () => {
  const failures: string[] = [];
  let shared = 0;
  for (const c of cases()) {
    try {
      const res = (await C.handleCommand(interaction(c.name, c.options) as never)) as { type: number; data?: Record<string, unknown> };
      assert.ok(res && typeof res.type === 'number', `${c.label}: no response`);
      assertWithinDiscordLimits(c.label, res);
      for (const id of customIds(res)) {
        const pressed = (await C.handleComponent({ ...interaction(c.name, []), type: 3, data: { id: 'd', custom_id: id, component_type: 2 } } as never)) as { data?: { content?: string; embeds?: unknown[] } };
        assertWithinDiscordLimits(`${c.label} [Share]`, pressed as never);
        const text = pressed.data?.content ?? '';
        assert.ok(!/too old to share/i.test(text), `${c.label}: Share button "${id}" does not decode`);
        shared++;
      }
    } catch (err) {
      failures.push(`${c.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`sweep: ${cases().length} invocations, ${shared} Share presses`);
  assert.ok(shared > 0, 'no Share button was exercised at all');
  assert.deepEqual(failures, []);
});

test('/stats pbs merges the two spellings of one run and filters by mode and size', async () => {
  const run = async (opts: Opt[]) => {
    const res = (await C.handleCommand(interaction('stats', [{ name: 'pbs', type: 1, options: opts }]) as never)) as {
      data?: { embeds?: { description?: string }[]; content?: string };
    };
    return res.data?.embeds?.[0]?.description ?? res.data?.content ?? '';
  };
  const all = await run([]);
  assert.equal((all.match(/^• Expert mode — /gm) ?? []).length, 1, 'one Expert mode line, not two spellings');
  assert.match(all, /^• Expert mode — `15:26\.00`/m, 'the faster of the two spellings wins');

  const hard = await run([{ name: 'page', type: 3, value: 'Tombs of Amascut' }, { name: 'mode', type: 3, value: 'hard' }]);
  assert.match(hard, /Expert mode 4 players/);
  assert.doesNotMatch(hard, /^• Solo — /m, 'normal-mode runs are filtered out');

  const solo = await run([{ name: 'page', type: 3, value: 'Tombs of Amascut' }, { name: 'size', type: 4, value: 1 }]);
  assert.match(solo, /^• Solo — /m);
  assert.match(solo, /^• Expert mode solo — /m);
  assert.doesNotMatch(solo, /2 players/);
});
