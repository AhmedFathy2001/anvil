// Seed a local preview: two clans in one database, so multi-clan routing is visible in a browser.
//
// Uses *.localtest.me, which public DNS resolves to 127.0.0.1 — no /etc/hosts edits, and subdomain
// routing behaves exactly as it will in production:
//
//   http://theafkspot.localtest.me:3000
//   http://secondclan.localtest.me:3000
//
// Run:  DATABASE_URL=... node scripts/migrate.mjs && DATABASE_URL=... node scripts/seed-preview.mjs
//
// Destructive: clears the clan-scoped tables it seeds. Preview databases only.

import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[seed] DATABASE_URL is required');
  process.exit(1);
}

const APEX = process.env.ANVIL_APEX_DOMAIN || 'localtest.me';
const c = new pg.Client({ connectionString: url });
await c.connect();

const iso = (daysFromNow) => new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

console.log('[seed] clearing previous preview data');
await c.query('TRUNCATE clans RESTART IDENTITY CASCADE');
await c.query('TRUNCATE users RESTART IDENTITY CASCADE');
// Accounts and people are global, so they are not reached by clearing the clans.
await c.query('TRUNCATE players RESTART IDENTITY CASCADE');

const CLANS = [
  {
    slug: 'theafkspot',
    name: 'The AFK Spot',
    inGame: 'AFK Spot',
    invite: 'https://discord.gg/afkspot',
    members: ['Zezima', 'Woox', 'B0aty', 'Settled', 'Faux'],
    event: { name: 'Summer Bingo', size: 5 },
  },
  {
    slug: 'secondclan',
    name: 'Second Clan',
    inGame: 'Second',
    invite: 'https://discord.gg/second',
    // Zezima is on BOTH rosters on purpose: one account, two clans, which is the case the identity
    // split exists for and the one worth being able to see in a browser.
    members: ['Odablock', 'Torvesta', 'Framed', 'Zezima'],
    event: { name: 'Autumn Board', size: 4 },
  },
];

for (const spec of CLANS) {
  const { rows: [clan] } = await c.query(
    `INSERT INTO clans (slug, name, in_game_name, plan) VALUES ($1,$2,$3,'free') RETURNING id`,
    [spec.slug, spec.name, spec.inGame],
  );

  // Per-clan config — the thing that used to leak between clans.
  for (const [k, v] of [
    ['clan_name', spec.name],
    ['clan_ingame_name', spec.inGame],
    ['discord_invite_url', spec.invite],
    ['public_showcase', 'on'],
  ]) {
    await c.query('INSERT INTO settings (clan_id, key, value) VALUES ($1,$2,$3)', [clan.id, k, v]);
  }

  // A roster seat is an ACCOUNT on a clan's roster, and an account belongs to a person. Accounts are
  // global, so an RSN seeded into both clans is deliberately ONE account with two seats — which is
  // the case worth being able to click through in a browser.
  for (const rsn of spec.members) {
    const norm = rsn.toLowerCase();
    let { rows: [account] } = await c.query('SELECT id FROM accounts WHERE rsn_normalized = $1', [norm]);
    if (!account) {
      const { rows: [person] } = await c.query(
        'INSERT INTO players (display_name) VALUES ($1) RETURNING id', [rsn]);
      ({ rows: [account] } = await c.query(
        `INSERT INTO accounts (player_id, rsn, rsn_normalized, status)
         VALUES ($1,$2,$3,'active') RETURNING id`,
        [person.id, rsn, norm],
      ));
    }
    await c.query(
      `INSERT INTO clan_memberships (clan_id, account_id, kind, source)
       VALUES ($1,$2,'member','roster')`,
      [clan.id, account.id],
    );
  }

  // A live board, so the events surface has something on it.
  const { rows: [event] } = await c.query(
    `INSERT INTO events (clan_id, name, board_size, start_date, end_date, scoring_mode, format, tiles_revealed)
     VALUES ($1,$2,$3,$4,$5,'points','bingo',1) RETURNING id`,
    [clan.id, spec.event.name, spec.event.size, iso(-3), iso(11)],
  );

  const { rows: [teamA] } = await c.query(
    `INSERT INTO teams (event_id, name, color) VALUES ($1,'Alpha','#d0553f') RETURNING id`, [event.id]);
  await c.query(`INSERT INTO teams (event_id, name, color) VALUES ($1,'Bravo','#4aa3d4')`, [event.id]);

  const tileCount = spec.event.size * spec.event.size;
  for (let i = 0; i < tileCount; i++) {
    const { rows: [tile] } = await c.query(
      `INSERT INTO tiles (event_id, position, label, points, revealed_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [event.id, i, `${spec.name} task ${i + 1}`, 10 + (i % 4) * 5, iso(-3)],
    );
    // A few completions so the board and the cards aren't empty.
    if (i % 4 === 0) {
      await c.query(
        `INSERT INTO completions (team_id, tile_id, completed_at) VALUES ($1,$2,$3)`,
        [teamA.id, tile.id, iso(-1)],
      );
    }
  }

  // A weekly competition, for the other half of the events hub.
  await c.query(
    `INSERT INTO weekly_competitions (clan_id, type, metric, title, start_date, end_date, status)
     VALUES ($1,'skill','mining',$2,$3,$4,'active')`,
    [clan.id, `${spec.name} Mining SOTW`, iso(-2), iso(5)],
  );

  console.log(`[seed] ${spec.name.padEnd(14)} -> http://${spec.slug}.${APEX}:${process.env.PORT || 3000}`);
}

await c.end();
console.log('[seed] done — the apex itself has no clan, so it 404s by design');
