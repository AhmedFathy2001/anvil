// Splitting one notification channel into nine, without turning anybody's posts off.
//
// Levels, quests, diaries and collection-log slots all announced as "combatAchievements", and pets as
// "rareDrops" — five kinds of post sharing two hooks, because that is how they were built and nobody
// had asked for more. Giving each its own channel is the easy half. The half that can go wrong
// silently is every clan and every person who already had this working: the day the split ships,
// their `webhook_levels` is blank and their combat-achievements hook is not, so a naive lookup takes
// their 99 posts away and reports nothing.
//
// Two different answers, because "blank" means two different things:
//
//   A CLAN'S blank channel is an unanswered question. It falls back at read time — its own hook, then
//   the base, then the channel it split from — so an admin who never opens the page keeps what they
//   had, and one who fills in a box gets the split. Nothing to migrate, nothing to undo.
//
//   A PERSON'S kinds list is a set of ticked boxes, and inheritance there would mean unticking Levels
//   didn't stop levels. So those expand once, in 0081, and the list is the whole truth afterwards.
//
// Run: npx tsx --test tests/notify-channels.test.ts

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { useTestDatabase, resetDatabase, dropDatabase, loadDb } from './helpers/testDb.ts';

const DB = useTestDatabase('notify-channels');

let pool: Awaited<ReturnType<typeof loadDb>>['pool'];
let clanId: number;
let settings: typeof import('../src/lib/settings.ts');
let pluginConfig: typeof import('../src/lib/pluginConfig.ts');

before(async () => {
  await resetDatabase(DB);
  const { db, pool: p, schema: s } = await loadDb();
  pool = p;
  settings = await import('../src/lib/settings.ts');
  pluginConfig = await import('../src/lib/pluginConfig.ts');

  const [clan] = await db.insert(s.clans).values({ slug: 'notify', name: 'Notify Clan' }).returning();
  clanId = clan.id;
});

after(async () => {
  await pool.end();
  await dropDatabase(DB);
});

async function clear() {
  for (const key of pluginConfig.WEBHOOK_SETTING_KEYS) await settings.setSetting(clanId, key, '');
}

const HOOK = (n: string) => `https://discord.com/api/webhooks/${n}`;

// ── A clan's channels ─────────────────────────────────────────────────────────────────────────

test('nothing configured means nothing posts', async () => {
  await clear();
  const w = await pluginConfig.getNotificationWebhooks(clanId);
  for (const channel of pluginConfig.NOTIFY_CHANNELS) {
    assert.equal(w[channel], null, `${channel} has nowhere to go`);
  }
});

test('the base hook alone turns every channel on', async () => {
  await clear();
  await settings.setSetting(clanId, pluginConfig.PLUGIN_WEBHOOK_BASE_KEY, HOOK('base'));
  const w = await pluginConfig.getNotificationWebhooks(clanId);
  for (const channel of pluginConfig.NOTIFY_CHANNELS) {
    assert.equal(w[channel], HOOK('base'), `${channel} follows the base`);
  }
});

test('a channel of its own beats the base', async () => {
  await clear();
  await settings.setSetting(clanId, pluginConfig.PLUGIN_WEBHOOK_BASE_KEY, HOOK('base'));
  await settings.setSetting(clanId, 'webhook_deaths', HOOK('deaths'));
  const w = await pluginConfig.getNotificationWebhooks(clanId);
  assert.equal(w.deaths, HOOK('deaths'), 'the specific answer wins');
  assert.equal(w.rareDrops, HOOK('base'), 'everything else still follows the base');
});

// This is the upgrade case, and the one worth having a test for: a clan that configured Anvil months
// ago has exactly these two settings and no base. Their 99s must keep arriving.
test('a clan that predates the split keeps every post it had', async () => {
  await clear();
  await settings.setSetting(clanId, 'webhook_combat_achievements', HOOK('ca'));
  await settings.setSetting(clanId, 'webhook_rare_drops', HOOK('drops'));

  const w = await pluginConfig.getNotificationWebhooks(clanId);
  assert.equal(w.levels, HOOK('ca'), '99s go where they always went');
  assert.equal(w.quests, HOOK('ca'));
  assert.equal(w.diaries, HOOK('ca'));
  assert.equal(w.collectionLog, HOOK('ca'));
  assert.equal(w.pets, HOOK('drops'), 'pets are still drops until told otherwise');
  assert.equal(w.deaths, null, 'a channel they never set is still unset');
});

test('splitting one kind out leaves its siblings where they were', async () => {
  await clear();
  await settings.setSetting(clanId, 'webhook_combat_achievements', HOOK('ca'));
  await settings.setSetting(clanId, 'webhook_levels', HOOK('levels'));

  const w = await pluginConfig.getNotificationWebhooks(clanId);
  assert.equal(w.levels, HOOK('levels'));
  assert.equal(w.quests, HOOK('ca'), 'quests were not the thing being moved');
});

// `leagues` answers "divert seasonal posts HERE". Inheriting a base would divert every seasonal post
// away from the channels the clan just set up — the opposite of what setting a base asked for.
test('the leagues override never inherits', async () => {
  await clear();
  await settings.setSetting(clanId, pluginConfig.PLUGIN_WEBHOOK_BASE_KEY, HOOK('base'));
  const w = await pluginConfig.getNotificationWebhooks(clanId);
  assert.equal(w.leagues, null, 'a base is not an instruction to split seasonal worlds off');
});

// ── A person's own hooks ──────────────────────────────────────────────────────────────────────

test('migration 0081 expands the kinds a personal hook already subscribed to', async () => {
  const { db, schema: s } = await loadDb();
  const [user] = await db
    .insert(s.users)
    .values({ discordId: 'notify-1', displayName: 'Hooked' })
    .returning();

  const before = [
    { kinds: '["combatAchievements","deaths"]', label: 'legacy CA hook' },
    { kinds: '["rareDrops"]', label: 'legacy drops hook' },
    { kinds: '["deaths"]', label: 'untouched' },
    { kinds: 'not json at all', label: 'garbage' },
  ];
  const ids: number[] = [];
  for (const row of before) {
    const [w] = await db
      .insert(s.userWebhooks)
      .values({ userId: user.id, url: HOOK(row.label), kinds: row.kinds, label: row.label })
      .returning();
    ids.push(w.id);
  }

  // Re-run the migration itself rather than a paraphrase of it — the harness applied it before these
  // rows existed, and it is written to be safe to run twice.
  await pool.query(readFileSync('drizzle/0081_split_notification_kinds.sql', 'utf-8'));

  const after = await pool.query<{ id: number; kinds: string }>(
    'SELECT id, kinds FROM user_webhooks WHERE id = ANY($1) ORDER BY id',
    [ids],
  );
  const kindsOf = (i: number) => JSON.parse(after.rows[i].kinds) as string[];

  const ca = kindsOf(0);
  for (const k of ['combatAchievements', 'levels', 'quests', 'diaries', 'collectionLog', 'deaths']) {
    assert.ok(ca.includes(k), `a CA subscriber keeps receiving ${k}`);
  }
  assert.ok(!ca.includes('pets'), 'and gains nothing it never asked for');

  assert.deepEqual(kindsOf(1).sort(), ['pets', 'rareDrops'], 'pets follow drops');
  assert.deepEqual(kindsOf(2), ['deaths'], 'a hook with nothing to expand is left alone');
  assert.equal(after.rows[3].kinds, 'not json at all', 'an unparseable row is left exactly as it was');
});
