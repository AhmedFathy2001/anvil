// The clans that signed up and never got going.
//
// WHAT THIS IS FOR. A clan is created in seconds and is unverified by definition until somebody
// pushes a roster from an owner-ranked account in the real clan — a thing you do in a game client,
// not on the site. Most founders do it within a day. The ones who do not are not a slow queue: they
// hit something and stopped, and nothing ever said so, so the clan sat empty until it was forgotten.
//
// The digest is therefore a to-do list of PEOPLE, and the rules that shape it are the ones tested
// here: a grace window so nobody is chased at 04:00 on the night they signed up, one reason per clan
// rather than three descriptions of the same blockage, oldest first because those are closest to
// lost, and silence when there is nothing — a daily "0 stalled" is how a channel becomes wallpaper.
//
// Run: npx tsx --test tests/leads-digest.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  GRACE_HOURS,
  LEADS_LIMIT,
  PEOPLE_SHOWN,
  STALE_DAYS,
  ageDays,
  buildLeadsDigest,
  isChaseable,
  reasonFor,
  type LeadRow,
} from '../src/lib/leadsDigest.ts';

const NOW = Date.parse('2026-09-11T12:00:00.000Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const hoursAgo = (n: number) => new Date(NOW - n * 3_600_000).toISOString();

function lead(over: Partial<LeadRow> = {}): LeadRow {
  return {
    id: 1,
    slug: 'stalled',
    name: 'Stalled Clan',
    inGameName: 'Stalled Clan',
    createdAt: daysAgo(3),
    verified: false,
    members: 0,
    events: 0,
    ownerName: 'Founder',
    ownerDiscordId: '123456789012345678',
    ownerEmail: 'founder@example.com',
    ...over,
  };
}

test('a clan gets a day to sort itself out before anybody is chased', () => {
  assert.equal(isChaseable(lead({ createdAt: hoursAgo(1) }), NOW), false, 'signed up an hour ago');
  assert.equal(
    isChaseable(lead({ createdAt: hoursAgo(GRACE_HOURS - 1) }), NOW),
    false,
    'still inside the grace window',
  );
  assert.equal(isChaseable(lead({ createdAt: hoursAgo(GRACE_HOURS + 1) }), NOW), true);
});

test('past a month a nudge is archaeology, not a follow-up', () => {
  assert.equal(isChaseable(lead({ createdAt: daysAgo(STALE_DAYS - 1) }), NOW), true);
  assert.equal(isChaseable(lead({ createdAt: daysAgo(STALE_DAYS + 5) }), NOW), false);
});

test('a clan that got going is not a lead', () => {
  const running = lead({ verified: true, members: 12, events: 2 });
  assert.equal(reasonFor(running), null);
  assert.equal(isChaseable(running, NOW), false);
  assert.equal(buildLeadsDigest({ clans: [running] }, NOW), null, 'and nothing is posted');
});

test('one reason per clan — the one that blocks the others', () => {
  // An unverified clan cannot sync a roster, so it cannot gain members, so it has nobody to run an
  // event for. Reporting all three would be reporting the same blockage three times.
  assert.equal(reasonFor(lead()), 'unverified');
  assert.equal(reasonFor(lead({ verified: true })), 'no-members');
  assert.equal(reasonFor(lead({ verified: true, members: 30 })), 'no-events');
});

test('silence only when nothing happened AND nothing is stuck', () => {
  assert.equal(buildLeadsDigest({ clans: [] }, NOW), null);
  assert.equal(buildLeadsDigest({ clans: [lead({ createdAt: hoursAgo(2) })] }, NOW), null, 'too new to chase');

  // A quiet day with sign-ups in it is still worth one line — that number is the thing this digest
  // exists to keep in front of somebody, whether or not anything is stuck.
  const quietButBusy = buildLeadsDigest(
    { clans: [], counts: { signUps: 3, clansCreated: 0, charactersLinked: 1 } },
    NOW,
  );
  assert.ok(quietButBusy);
  assert.match(quietButBusy.title, /3 sign-ups/);
  assert.match(quietButBusy.description, /Nothing stalled/);

  // …but a day with neither is not a message.
  assert.equal(
    buildLeadsDigest({ clans: [], counts: { signUps: 0, clansCreated: 0, charactersLinked: 0 } }, NOW),
    null,
  );
});

test('the headline is the day, not the backlog', () => {
  const embed = buildLeadsDigest(
    { clans: [lead()], counts: { signUps: 11, clansCreated: 2, charactersLinked: 7 } },
    NOW,
  );
  assert.ok(embed);
  assert.match(embed.title, /Yesterday — 11 sign-ups · 2 clans · 7 characters linked/);
  assert.match(embed.description, /1 clan stalled/);
});

test('people who signed up and stopped are a count with a few examples', () => {
  // Never a list: a name with no clan and no character tells you nothing the number does not, and
  // at announcement volume the list would be the whole message.
  const people = Array.from({ length: PEOPLE_SHOWN + 6 }, (_, i) => ({
    displayName: `Person ${i}`,
    discordId: `10000000000000000${i}`,
    email: `p${i}@example.com`,
  }));
  const embed = buildLeadsDigest({ clans: [], counts: { signUps: 0, clansCreated: 0, charactersLinked: 0 }, people }, NOW);
  assert.ok(embed);
  const field = embed.fields.at(-1)!;
  assert.match(field.name, new RegExp(`${PEOPLE_SHOWN + 6} signed up and stopped`));
  assert.match(field.value, /6 more/);
  assert.equal((field.value.match(/discord\.com\/users/g) ?? []).length, PEOPLE_SHOWN);
});

test('oldest first — those are the ones running out of time', () => {
  const embed = buildLeadsDigest(
    {
      clans: [
        lead({ id: 1, name: 'Yesterday', createdAt: daysAgo(2) }),
        lead({ id: 2, name: 'Three weeks', createdAt: daysAgo(21) }),
        lead({ id: 3, name: 'A week', createdAt: daysAgo(7) }),
      ],
    },
    NOW,
  );
  assert.ok(embed);
  assert.deepEqual(
    embed.fields.map((f) => f.name.split(' —')[0]),
    ['Three weeks', 'A week', 'Yesterday'],
  );
});

test('every row names the person and how to reach them', () => {
  // The action is a message, not a database change, so a digest that makes you go and look the owner
  // up has moved the work rather than done it.
  const embed = buildLeadsDigest({ clans: [lead()] }, NOW);
  assert.ok(embed);
  const row = embed.fields[0].value;
  assert.match(row, /discord\.com\/users\/123456789012345678/);
  assert.match(row, /founder@example\.com/);
  assert.match(row, /cannot sync a roster/);
});

test('a long list is capped, and says how much it left out', () => {
  const many = Array.from({ length: LEADS_LIMIT + 4 }, (_, i) =>
    lead({ id: i + 1, name: `Clan ${i}`, createdAt: daysAgo(2 + i) }),
  );
  const embed = buildLeadsDigest({ clans: many }, NOW);
  assert.ok(embed);
  // The capped list, plus the one row that says what it left out.
  assert.equal(embed.fields.length, LEADS_LIMIT + 1);
  assert.match(embed.fields.at(-1)!.name, /4 more/);
  assert.match(embed.description, new RegExp(`${LEADS_LIMIT + 4} clans stalled`));
});

test('an unreadable timestamp is left alone rather than reported forever', () => {
  // NaN would compare as "infinitely old" and put the row in every digest for good.
  assert.equal(ageDays('not a date', NOW), null);
  assert.equal(isChaseable(lead({ createdAt: 'not a date' }), NOW), false);
  assert.equal(isChaseable(lead({ createdAt: null }), NOW), false);
});

test('both timestamp formats parse — ISO and Postgres space-separated', () => {
  // lib/dbTime: these columns carry either, and only the date prefix means the same in both.
  assert.equal(ageDays('2026-09-08T12:00:00.000Z', NOW), 3);
  assert.equal(ageDays('2026-09-08 12:00:00', NOW), 3);
});
