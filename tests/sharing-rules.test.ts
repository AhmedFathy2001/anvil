// Account-sharing checks, the pure rules (lib/sharingRules): what a board's network sightings add up
// to, and the line staff read.
//
//   1. one person's own accounts on one network: no flag
//   3. an account added mid-contest: flagged; strongly when it connects from another country than its
//      owner's other accounts
//   4. different people's accounts (or unknown owners) on one network: flagged, saying what is known
//
// (2, another login's plugin, and 5, two countries, are pinned in tests/sharing-checks-db.test.ts,
// tests/other-login.test.ts and tests/footprint.test.ts.)
//
// Run: npx tsx --test tests/sharing-rules.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  lateAddHours, lateAdds, ownerRelation, ownershipConfirmed, sharedNetworkRelation, sharingSignalText, sharingSignals,
  type AccountOwner, type NetSighting, type SharingPlayer,
} from '../src/lib/sharingRules.ts';

const H = 3_600_000;
const START = Date.UTC(2026, 10, 1, 12);

const owned = (personId: number, confirmed = true): AccountOwner => ({ personId, claimed: true, confirmed });
const unclaimed = (personId: number): AccountOwner => ({ personId, claimed: false, confirmed: false });

/** On the board from the start unless `lateH` says how many hours in they were added. */
function player(id: number, name: string, owner: AccountOwner | null, teamId: number | null = 1, lateH = 0): SharingPlayer {
  const pickedMs = START + lateH * H - (lateH ? 0 : 24 * H);
  return { id, name, teamId, owner, pickedMs, baselineMs: lateH ? pickedMs + 60_000 : START + 5 * 60_000 };
}
const at = (participantId: number, netHash: string, country: string | null = 'NL'): NetSighting => ({ participantId, netHash, country });

/** Five on the board from the start, so one late arrival is the exception (see lateAdds). */
const field = (from = 90): SharingPlayer[] => [0, 1, 2, 3, 4].map((i) => player(from + i, `Filler ${i}`, owned(900 + i), 9));

const kinds = (signals: { participantId: number; kind: string }[]) => signals.map((s) => `${s.participantId}>${s.kind}`).sort();

test('ownership: confirmed only by a real check; same person only off the claim', () => {
  assert.equal(ownershipConfirmed({ verifiedAt: 'x', provisional: 0, verificationMethod: 'plugin' }), true);
  assert.equal(ownershipConfirmed({ verifiedAt: 'x', provisional: 1, verificationMethod: 'plugin' }), false);
  assert.equal(ownershipConfirmed({ verifiedAt: 'x', provisional: 0, verificationMethod: 'plugin_first_use' }), false);
  assert.equal(ownershipConfirmed({ verifiedAt: null, provisional: 0, verificationMethod: 'manual' }), false);

  assert.equal(ownerRelation(owned(1), owned(1)), 'same');
  assert.equal(ownerRelation(owned(1), owned(1, false)), 'same_unconfirmed');
  assert.equal(ownerRelation(owned(1), owned(2)), 'different');
  // A placeholder person holding two roster names is not "the same person".
  assert.equal(ownerRelation(unclaimed(5), unclaimed(5)), 'unknown');
  assert.equal(ownerRelation(owned(1), null), 'unknown');
  assert.equal(ownerRelation(owned(1), { personId: null, claimed: true, confirmed: true }), 'unknown');
});

test('case 1: one person’s own accounts on one network raise nothing', () => {
  const players = [player(1, 'Main', owned(1)), player(2, 'Iron Alt', owned(1)), player(3, 'Third Alt', owned(1), 2)];
  const { shared, late } = sharingSignals({ startMs: START, players, sightings: [at(1, 'home'), at(2, 'home'), at(3, 'home')] });
  assert.deepEqual(shared, []);
  assert.deepEqual(late, []);
});

test('case 1: the network itself is never what makes two accounts one person’s', () => {
  // Same network, same team, but the site's records say two people: still shown.
  const players = [player(1, 'Main', owned(1)), player(2, 'Friend', owned(2))];
  const { shared } = sharingSignals({ startMs: START, players, sightings: [at(1, 'home'), at(2, 'home')] });
  assert.deepEqual(kinds(shared), ['1>shared_network:2', '2>shared_network:1']);
});

test('case 4: different people on one network are flagged both ways, once per pair', () => {
  const players = [player(1, 'Alice', owned(1), 1), player(2, 'Bob', owned(2), 1), player(3, 'Carol', owned(3), 2)];
  const sightings = [at(1, 'n1'), at(2, 'n1'), at(1, 'n2'), at(2, 'n2'), at(3, 'n1')];
  const { shared } = sharingSignals({ startMs: START, players, sightings });
  assert.deepEqual(kinds(shared), [
    '1>shared_network:2', '1>shared_network:3', '2>shared_network:1', '2>shared_network:3', '3>shared_network:1', '3>shared_network:2',
  ]);
  assert.deepEqual(shared.find((s) => s.participantId === 1 && s.kind === 'shared_network:2')!.detail, { other: 'Bob', sameTeam: true });
  assert.deepEqual(shared.find((s) => s.participantId === 1 && s.kind === 'shared_network:3')!.detail, { other: 'Carol', sameTeam: false });
  // The stored signal names the other character and nothing about the network.
  assert.ok(shared.every((s) => !JSON.stringify(s.detail).includes('n1')));
});

test('case 4: unknown owners and unconfirmed links stay flagged; a mixed network drops only the own pair', () => {
  const players = [
    player(1, 'Main', owned(1)), player(2, 'Alt', owned(1)), // one person, confirmed
    player(3, 'Roster Name', unclaimed(7)), // nobody's
    player(4, 'First Use', owned(1, false)), // linked to person 1 by the plugin, unconfirmed
  ];
  const { shared } = sharingSignals({ startMs: START, players, sightings: [1, 2, 3, 4].map((id) => at(id, 'lan')) });
  const got = kinds(shared);
  assert.ok(!got.includes('1>shared_network:2') && !got.includes('2>shared_network:1'), 'the confirmed own pair is not a flag');
  assert.ok(got.includes('1>shared_network:3') && got.includes('3>shared_network:1'), 'unknown owner: shown');
  assert.ok(got.includes('1>shared_network:4') && got.includes('4>shared_network:2'), 'unconfirmed link: kept');
  assert.equal(got.length, 10);
});

test('case 4: the owners are read when staff open the list, and a pair that is one person’s is left out', () => {
  const owners = new Map<number, AccountOwner | null>([[1, owned(1)], [2, owned(1)], [3, owned(2)], [4, owned(1, false)], [5, null]]);
  assert.equal(sharedNetworkRelation('shared_network:2', 1, owners), 'same'); // e.g. raised before the rule changed
  assert.equal(sharedNetworkRelation('shared_network:3', 1, owners), 'different');
  assert.equal(sharedNetworkRelation('shared_network:4', 1, owners), 'same_unconfirmed');
  assert.equal(sharedNetworkRelation('shared_network:5', 1, owners), 'unknown');
  assert.equal(sharedNetworkRelation('shared_network:99', 1, owners), null, 'the other enrolment is gone');
  assert.equal(sharedNetworkRelation('two_countries', 1, owners), null);
});

test('case 3: added mid-contest means placed after the start, not moved between teams', () => {
  const p = (pickedH: number | null, baselineH: number | null, teamId: number | null = 1) =>
    ({ teamId, pickedMs: pickedH == null ? null : START + pickedH * H, baselineMs: baselineH == null ? null : START + baselineH * H });
  assert.equal(lateAddHours(START, p(-24, 0.1)), null, 'there from the start');
  assert.equal(lateAddHours(START, p(0.5, 0.6)), null, 'inside the first hour: a draft running over');
  assert.equal(lateAddHours(START, p(50, 50.02)), 50, 'placed two days in, starting line taken then');
  assert.equal(lateAddHours(START, p(50, null)), 50, 'placed, starting line not read yet');
  assert.equal(lateAddHours(START, p(50, 0.1)), null, 'starting line from the start: a team move');
  assert.equal(lateAddHours(START, p(50, 50.02, null)), null, 'on no team');
  assert.equal(lateAddHours(START, p(null, 50)), null, 'no placement time: unknown, not late');
});

test('case 3: late arrivals are a flag only while they are the exception', () => {
  const late = [player(1, 'Late A', owned(1), 1, 30), player(2, 'Late B', owned(2), 1, 40)];
  assert.deepEqual([...lateAdds(START, [...late, ...field()])], [[1, 30], [2, 40]]);
  // Teams drafted after the start, or a board that enrols people as they play: nobody stands out.
  assert.deepEqual([...lateAdds(START, [...late, player(3, 'Late C', owned(3), 1, 45), ...field().slice(0, 2)])], []);
  // People signed up but on no team are not part of the field.
  assert.equal(lateAdds(START, [...late, ...field().map((p) => ({ ...p, teamId: null }))]).size, 0);
});

test('case 3, mild: a late account on its owner’s own network is the plain line, naming the account', () => {
  const players = [player(1, 'Main', owned(1)), player(2, 'New Alt', owned(1), 1, 72), ...field()];
  const { shared, late } = sharingSignals({ startMs: START, players, sightings: [at(1, 'home'), at(2, 'home')] });
  assert.deepEqual(shared, [], 'still no shared-network flag for the owner’s own accounts');
  assert.deepEqual(late, [{ participantId: 2, kind: 'late_account', detail: { lateHours: 72, sameNetworkAs: 'Main' } }]);
});

test('case 3: a late account with nothing else known is the plain line', () => {
  const players = [player(2, 'Newcomer', owned(5), 1, 26), ...field()];
  assert.deepEqual(sharingSignals({ startMs: START, players, sightings: [] }).late, [
    { participantId: 2, kind: 'late_account', detail: { lateHours: 26 } },
  ]);
  // Same country as the team it joined: nothing more to say.
  const withTeam = [player(2, 'Newcomer', owned(5), 9, 26), ...field()];
  const sightings = [at(2, 'a'), ...field().map((p) => at(p.id, `n${p.id}`))];
  assert.deepEqual(kinds(sharingSignals({ startMs: START, players: withTeam, sightings }).late), ['2>late_account']);
});

test('case 3, strong: a late account connecting from another country than its owner’s other accounts', () => {
  const players = [player(1, 'Main', owned(1)), player(2, 'New Alt', owned(1), 1, 72), ...field()];
  const sightings = [at(1, 'home', 'NL'), at(2, 'home', 'NL'), at(2, 'far', 'PH')];
  const { late } = sharingSignals({ startMs: START, players, sightings });
  assert.deepEqual(late, [
    { participantId: 2, kind: 'late_account', detail: { lateHours: 72, sameNetworkAs: 'Main' } },
    { participantId: 2, kind: 'late_account_far', detail: { lateHours: 72, countries: ['PH'], against: 'owner' } },
  ]);
  // Only the flagged account's own country is kept: nobody else's location is written down.
  assert.ok(!JSON.stringify(late).includes('NL'));
  // The owner's own play decides, not the team's: teammates in PH don't make PH usual for this person.
  const teamInPh = [...sightings, ...field().map((p) => at(p.id, `n${p.id}`, 'PH'))];
  const samePlayersOnTeam9 = players.map((p) => (p.id === 2 ? { ...p, teamId: 9 } : p));
  assert.ok(kinds(sharingSignals({ startMs: START, players: samePlayersOnTeam9, sightings: teamInPh }).late).includes('2>late_account_far'));
});

test('case 3: with no other account of its owner, the team is the yardstick; no country, no judgement', () => {
  const players = [player(2, 'Ringer', owned(5), 9, 48), ...field()];
  const team = field().map((p) => at(p.id, `n${p.id}`, 'NL'));
  const far = sharingSignals({ startMs: START, players, sightings: [...team, at(2, 'x', 'VE')] }).late;
  assert.deepEqual(far.find((s) => s.kind === 'late_account_far')!.detail, { lateHours: 48, countries: ['VE'], against: 'team' });
  // Cloudflare gave no country for the newcomer, or nobody to compare with: plain line only.
  assert.deepEqual(kinds(sharingSignals({ startMs: START, players, sightings: [...team, at(2, 'x', null)] }).late), ['2>late_account']);
  assert.deepEqual(kinds(sharingSignals({ startMs: START, players, sightings: [at(2, 'x', 'VE')] }).late), ['2>late_account']);
  // An account there from the start is never "far", wherever it connects from.
  const early = [player(2, 'Traveller', owned(5), 9), ...field()];
  assert.deepEqual(sharingSignals({ startMs: START, players: early, sightings: [...team, at(2, 'x', 'VE')] }).late, []);
});

test('wording: each line says what is known, and how much it weighs', () => {
  const text = (kind: string, d: object, owners?: Parameters<typeof sharingSignalText>[2]) => sharingSignalText(kind, d, owners)!;

  const diff = text('shared_network:2', { other: 'Bob', sameTeam: true }, 'different');
  assert.equal(diff.weight, 2);
  assert.equal(diff.text, 'Same network as teammate Bob. The two characters belong to different Anvil logins: one household, or one person playing both.');
  assert.match(text('shared_network:2', { other: 'Bob', sameTeam: false }, 'different').text, /^Same network as Bob, on another team\./);

  const unknown = text('shared_network:2', { other: 'Bob', sameTeam: true }, 'unknown');
  assert.equal(unknown.weight, 2);
  assert.match(unknown.text, /not linked to an Anvil login right now, so whether they are one person's is not known/);

  // Weak: shown only beside another signal for the same player.
  const unconfirmed = text('shared_network:2', { other: 'Alt', sameTeam: true }, 'same_unconfirmed');
  assert.equal(unconfirmed.weight, 1);
  assert.match(unconfirmed.text, /linked to the same Anvil login, but one of those links .* nobody has confirmed it/);

  // The other enrolment is gone: only the fact that was recorded.
  assert.equal(text('shared_network:2', { other: 'Bob', sameTeam: true }, null).text, 'Same network as teammate Bob.');

  const plain = text('late_account', { lateHours: 26 });
  assert.deepEqual(plain, { weight: 2, tag: 'added late', text: 'Put on the team 26 hours after the event started.' });
  const mild = text('late_account', { lateHours: 72, sameNetworkAs: 'Main' });
  assert.equal(mild.weight, 2);
  assert.match(mild.text, /^Put on the team 3 days after the event started\. It connects from the same network as Main, which belongs to the same Anvil login/);

  const strong = text('late_account_far', { lateHours: 72, countries: ['PH'], against: 'owner' });
  assert.equal(strong.weight, 3);
  assert.equal(strong.tag, 'added late, far away');
  assert.match(strong.text, /connects from PH: a country the other characters of the same Anvil login have not connected from/);
  const team = text('late_account_far', { lateHours: 72, countries: ['VE'], against: 'team' });
  assert.equal(team.weight, 2);
  assert.match(team.text, /connects from VE: a country nobody else on its team has connected from/);

  // Never a verdict, never a network code.
  for (const t of [diff, unknown, unconfirmed, plain, mild, strong, team]) assert.doesNotMatch(t.text, /cheat|caught|proof|hash/i);
  assert.equal(sharingSignalText('two_countries', {}), null);
});
