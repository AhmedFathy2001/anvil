// The host's view of a co-host's Discord for one board (lib/partnerReadiness).
//
// Run: node --experimental-strip-types --test tests/partner-readiness.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { partnerPosts, partnerVerdict, type PartnerFacts } from '../src/lib/partnerReadiness.ts';

const base: PartnerFacts = {
  hostShare: 'all',
  preset: 'host',
  ownChannel: false,
  defaultChannel: true,
  botConnected: true,
  playerRoleReady: false,
  ownTeams: 0,
  teamsBuilt: 0,
  autoTeamChannels: false,
};

test('where posts land: the host’s cap first, then the partner’s choice, then its channel', () => {
  assert.equal(partnerPosts({ ...base, hostShare: 'none', ownChannel: true }), 'host-off');
  assert.equal(partnerPosts({ ...base, preset: 'off', ownChannel: true }), 'partner-off');
  assert.equal(partnerPosts({ ...base, ownChannel: true }), 'own-channel');
  assert.equal(partnerPosts(base), 'default-channel');
  assert.equal(partnerPosts({ ...base, defaultChannel: false }), 'no-channel');
});

test('verdict: ready when what applies is set up, partial when a piece is missing, nothing when idle', () => {
  assert.equal(partnerVerdict(base), 'ready');
  assert.equal(partnerVerdict({ ...base, defaultChannel: false }), 'nothing');
  assert.equal(partnerVerdict({ ...base, defaultChannel: false, playerRoleReady: true }), 'partial');
  assert.equal(partnerVerdict({ ...base, ownTeams: 2, teamsBuilt: 1 }), 'partial');
  assert.equal(partnerVerdict({ ...base, ownTeams: 2, teamsBuilt: 2 }), 'ready');
  // Posts off by choice is not a gap.
  assert.equal(partnerVerdict({ ...base, preset: 'off', playerRoleReady: true }), 'ready');
});
