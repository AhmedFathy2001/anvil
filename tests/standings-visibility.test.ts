// The standings curtain (lib/standingsVisibility) and its rule (lib/eventRules `standings`).
//
// Run: npx tsx --test tests/standings-visibility.test.ts
// (tsx for the `@/` alias; both modules are pure and touch no database.)

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseEventRules, validateEventRules, mergeEventRulesPatch } from '../src/lib/eventRules.ts';
import {
  canSeeTeamProgress,
  curtainInfo,
  filterToVisibleTeams,
  hasStandingsCurtain,
  standingsHidden,
  standingsHiddenFor,
  standingsHiddenNotice,
  standingsRevealAt,
  type StandingsViewer,
} from '../src/lib/standingsVisibility.ts';

const H = 3_600_000;
const NOW = Date.parse('2026-11-10T12:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

function event(standings: unknown, end: number | null = NOW + 7 * 24 * H, forceEnded: number | null = null) {
  return {
    rules: standings === undefined ? null : JSON.stringify({ standings }),
    endDate: end != null ? iso(end) : null,
    forceEndedAt: forceEnded != null ? iso(forceEnded) : null,
  };
}

const PUBLIC: StandingsViewer | null = null;
const MEMBER_A: StandingsViewer = { staff: false, teamIds: [1] };
const STAFF: StandingsViewer = { staff: true, teamIds: [] };

// ---- the rule ---------------------------------------------------------------------------------

test('absent rule parses to live, and live is the stored default (NULL)', () => {
  assert.deepEqual(parseEventRules(null).standings, { visibility: 'live', revealAt: null });
  const v = validateEventRules({ standings: { visibility: 'live' } });
  assert.deepEqual(v, { rules: null });
});

test('at-end survives on its own', () => {
  const v = validateEventRules({ standings: { visibility: 'at-end', revealAt: '2026-01-01T00:00:00Z' } });
  assert.ok(!('error' in v));
  const back = parseEventRules(v.rules);
  // A date on an at-end curtain means nothing and isn't kept.
  assert.deepEqual(back.standings, { visibility: 'at-end', revealAt: null });
});

test('at-date survives and canonicalises its date to ISO', () => {
  const v = validateEventRules({ standings: { visibility: 'at-date', revealAt: '2026-11-15T18:30:00+02:00' } });
  assert.ok(!('error' in v));
  assert.deepEqual(parseEventRules(v.rules).standings, { visibility: 'at-date', revealAt: '2026-11-15T16:30:00.000Z' });
});

test('validation refuses a bad visibility and an at-date with no usable date', () => {
  assert.ok('error' in validateEventRules({ standings: { visibility: 'sometimes' } }));
  assert.ok('error' in validateEventRules({ standings: { visibility: 'at-date' } }));
  assert.ok('error' in validateEventRules({ standings: { visibility: 'at-date', revealAt: 'next tuesday' } }));
  assert.ok('error' in validateEventRules({ standings: 'at-end' }));
});

test('a stored at-date with a broken date fails CLOSED (reads as at-end), garbage reads as live', () => {
  assert.deepEqual(parseEventRules(JSON.stringify({ standings: { visibility: 'at-date', revealAt: 'nope' } })).standings, {
    visibility: 'at-end',
    revealAt: null,
  });
  assert.equal(parseEventRules(JSON.stringify({ standings: 42 })).standings.visibility, 'live');
});

test('a rules PATCH that only touches standings keeps the other keys, and null clears it', () => {
  const stored = JSON.stringify({ firstBonus: 5 });
  const merged = mergeEventRulesPatch(stored, { standings: { visibility: 'at-end' } });
  const v = validateEventRules(merged);
  assert.ok(!('error' in v));
  const back = parseEventRules(v.rules);
  assert.equal(back.firstBonus, 5);
  assert.equal(back.standings.visibility, 'at-end');
  const cleared = validateEventRules(mergeEventRulesPatch(v.rules, { standings: null }));
  assert.ok(!('error' in cleared));
  assert.equal(parseEventRules(cleared.rules).standings.visibility, 'live');
});

// ---- live -------------------------------------------------------------------------------------

test('live: nothing is ever hidden, for anyone', () => {
  const e = event(undefined);
  assert.equal(hasStandingsCurtain(e), false);
  assert.equal(standingsHidden(e, NOW), false);
  assert.equal(standingsRevealAt(e), null);
  for (const viewer of [PUBLIC, MEMBER_A, STAFF]) {
    assert.deepEqual(standingsHiddenFor(e, viewer, NOW), { hidden: false });
  }
});

// ---- at-end -----------------------------------------------------------------------------------

test('at-end: hidden before the end, for the public and members; staff always see', () => {
  const e = event({ visibility: 'at-end' });
  assert.equal(standingsHidden(e, NOW), true);
  assert.equal(standingsRevealAt(e), e.endDate);
  const pub = standingsHiddenFor(e, PUBLIC, NOW);
  assert.equal(pub.hidden, true);
  assert.equal(pub.hidden && pub.ownTeamIds.size, 0);
  const member = standingsHiddenFor(e, MEMBER_A, NOW);
  assert.equal(member.hidden, true);
  assert.equal(member.hidden && member.mode, 'at-end');
  assert.deepEqual(standingsHiddenFor(e, STAFF, NOW), { hidden: false });
});

test('at-end: revealed for everyone at and after the end', () => {
  const e = event({ visibility: 'at-end' }, NOW);
  assert.equal(standingsHidden(e, NOW), false);
  assert.deepEqual(standingsHiddenFor(e, PUBLIC, NOW + 1), { hidden: false });
  assert.deepEqual(standingsHiddenFor(e, MEMBER_A, NOW + 1), { hidden: false });
});

test('at-end: a force-end lifts the curtain early', () => {
  const e = event({ visibility: 'at-end' }, NOW + 48 * H, NOW - H);
  assert.equal(standingsHidden(e, NOW), false);
  assert.equal(standingsRevealAt(e), iso(NOW - H));
});

test('at-end with no end date stays hidden and has no reveal time', () => {
  const e = event({ visibility: 'at-end' }, null);
  assert.equal(standingsHidden(e, NOW), true);
  assert.equal(standingsRevealAt(e), null);
});

// ---- at-date ----------------------------------------------------------------------------------

test('at-date: hidden before the date, visible after, staff unaffected', () => {
  const at = NOW + 2 * H;
  const e = event({ visibility: 'at-date', revealAt: iso(at) });
  assert.equal(standingsHidden(e, NOW), true);
  assert.equal(standingsRevealAt(e), iso(at));
  const before = standingsHiddenFor(e, MEMBER_A, NOW);
  assert.equal(before.hidden && before.mode, 'at-date');
  assert.equal(before.hidden && before.revealAt, iso(at));
  assert.deepEqual(standingsHiddenFor(e, STAFF, NOW), { hidden: false });
  assert.equal(standingsHidden(e, at), false);
  assert.deepEqual(standingsHiddenFor(e, PUBLIC, at + 1), { hidden: false });
  assert.deepEqual(standingsHiddenFor(e, MEMBER_A, at + 1), { hidden: false });
});

test('at-date after the end lifts at the end instead', () => {
  const end = NOW + H;
  const e = event({ visibility: 'at-date', revealAt: iso(NOW + 10 * H) }, end);
  assert.equal(standingsRevealAt(e), iso(end));
  assert.equal(standingsHidden(e, end + 1), false);
});

test('the "final week" preset (end − 7 days) is just an at-date', () => {
  const end = NOW + 10 * 24 * H;
  const e = event({ visibility: 'at-date', revealAt: iso(end - 7 * 24 * H) }, end);
  assert.equal(standingsHidden(e, NOW), true);
  assert.equal(standingsHidden(e, end - 7 * 24 * H + 1), false);
});

// ---- the own-team exception -------------------------------------------------------------------

test('a member sees their own team and nobody else; the public sees no team', () => {
  const e = event({ visibility: 'at-end' });
  const member = standingsHiddenFor(e, { staff: false, teamIds: [1, 3] }, NOW);
  assert.equal(canSeeTeamProgress(member, 1), true);
  assert.equal(canSeeTeamProgress(member, 3), true);
  assert.equal(canSeeTeamProgress(member, 2), false);
  assert.equal(canSeeTeamProgress(member, null), false);
  const pub = standingsHiddenFor(e, PUBLIC, NOW);
  assert.equal(canSeeTeamProgress(pub, 1), false);
  const rows = [{ teamId: 1 }, { teamId: 2 }, { teamId: 3 }, { teamId: null }];
  assert.deepEqual(filterToVisibleTeams(member, rows, (r) => r.teamId).map((r) => r.teamId), [1, 3]);
  assert.deepEqual(filterToVisibleTeams(pub, rows, (r) => r.teamId), []);
  // Staff and a lifted curtain filter nothing.
  assert.equal(filterToVisibleTeams(standingsHiddenFor(e, STAFF, NOW), rows, (r) => r.teamId).length, 4);
});

test('curtainInfo and the notice wording', () => {
  const at = NOW + 2 * H;
  const dated = standingsHiddenFor(event({ visibility: 'at-date', revealAt: iso(at) }), MEMBER_A, NOW);
  const info = curtainInfo(dated);
  assert.deepEqual(info, { revealAt: iso(at), mode: 'at-date', ownTeamIds: [1] });
  assert.equal(standingsHiddenNotice(info!, () => 'Thursday'), 'Standings are hidden until Thursday.');
  const atEnd = curtainInfo(standingsHiddenFor(event({ visibility: 'at-end' }), PUBLIC, NOW));
  assert.equal(standingsHiddenNotice(atEnd!), 'Standings are hidden until the end of the event.');
  assert.equal(curtainInfo({ hidden: false }), null);
});

test('rules may be passed already parsed', () => {
  const rules = parseEventRules(JSON.stringify({ standings: { visibility: 'at-end' } }));
  assert.equal(standingsHidden({ rules, endDate: iso(NOW + H) }, NOW), true);
});

// ---- Discord routing --------------------------------------------------------------------------

import { curtainRoute, PROGRESS_POST_KINDS } from '../src/lib/standingsVisibility.ts';
import { DISCORD_POST_TYPES } from '../src/lib/discordPostPolicy.ts';
import { eventLinkDescription } from '../src/lib/linkText.ts';

test('every progress kind is a real Discord post type (the two lists cannot drift apart)', () => {
  const known = new Set<string>(DISCORD_POST_TYPES.map((t) => t.key));
  for (const kind of PROGRESS_POST_KINDS) assert.ok(known.has(kind), `${kind} is not a DiscordPostType`);
  // The reveal post itself must never be suppressed by the curtain it announces the end of.
  assert.ok(known.has('standingsRevealed'));
  assert.equal(PROGRESS_POST_KINDS.has('standingsRevealed'), false);
});

test('curtain up: every post goes everywhere', () => {
  assert.deepEqual(curtainRoute('tileComplete', 4, false), { shared: true, teamOnly: null });
  assert.deepEqual(curtainRoute('digest', null, false), { shared: true, teamOnly: null });
});

test('curtain down: a team progress post reaches only that team’s own hooks', () => {
  for (const kind of ['submissions', 'submissionRemoved', 'tileComplete', 'teamWin']) {
    assert.deepEqual(curtainRoute(kind, 4, true), { shared: false, teamOnly: 4 }, kind);
  }
});

test('curtain down: an event-wide progress post (digest, halfway, claims) goes nowhere', () => {
  for (const kind of ['digest', 'halfway', 'claims', 'monthlyChampion', 'eventEnd']) {
    assert.deepEqual(curtainRoute(kind, undefined, true), { shared: false, teamOnly: null }, kind);
  }
});

test('curtain down: posts that are not progress are untouched', () => {
  for (const kind of ['eventStart', 'boardRevealed', 'reveals', 'rules', 'draftDone', 'standingsRevealed']) {
    assert.deepEqual(curtainRoute(kind, null, true), { shared: true, teamOnly: null }, kind);
  }
});

// ---- link cards -------------------------------------------------------------------------------

test('a hidden board’s link text names no leader', () => {
  const ev = { startDate: iso(NOW - 24 * H), endDate: iso(NOW + 48 * H), forceEndedAt: null };
  const standings = [
    { name: 'Iron Wolves', score: 420, unit: 'pts' },
    { name: 'Reds', score: 100, unit: 'pts' },
  ];
  assert.match(eventLinkDescription(ev, standings, NOW), /Iron Wolves lead/);
  const hidden = eventLinkDescription(ev, standings, NOW, { standingsHidden: true });
  assert.doesNotMatch(hidden, /Iron Wolves|420/);
  assert.match(hidden, /standings hidden/);
});
