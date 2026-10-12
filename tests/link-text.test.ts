// The line under a link's title in Discord — events, Skill/Boss of the Week, members.
//
// Pure: lib/linkText imports no database, so the card and the page description can share it.
//
// Run: npm run test:linktext

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  compact,
  eventLinkDescription,
  memberLinkDescription,
  timeLeft,
  weeklyGain,
  weeklyLinkDescription,
} from '../src/lib/linkText.ts';

const NOW = Date.parse('2026-10-12T12:00:00Z');

test('timeLeft reads both timestamp formats and drops a zero hour', () => {
  assert.equal(timeLeft('2026-10-14T16:00:00Z', NOW), '2d 4h');
  assert.equal(timeLeft('2026-10-15 12:00:00', NOW), '3d');
  assert.equal(timeLeft('2026-10-12 12:40:00', NOW), '40m');
  assert.equal(timeLeft('2026-10-01 00:00:00', NOW), null);
  assert.equal(timeLeft(null, NOW), null);
});

test('compact keeps three significant figures', () => {
  assert.equal(compact(4_820_113), '4.82M');
  assert.equal(compact(58_912_000), '58.9M');
  assert.equal(compact(31_400), '31.4K');
  assert.equal(compact(212), '212');
});

test('a live board names its leader, a tie names nobody', () => {
  const event = { startDate: '2026-10-10 12:00:00', endDate: '2026-10-14T16:00:00Z', forceEndedAt: null };
  assert.equal(
    eventLinkDescription(event, [{ name: 'Iron Wolves', score: 420, unit: 'pts' }, { name: 'Ravens', score: 365, unit: 'pts' }], NOW),
    'Live now · Iron Wolves lead with 420 pts · 2 teams · ends in 2d 4h',
  );
  assert.equal(
    eventLinkDescription(event, [{ name: 'A', score: 5, unit: 'tiles' }, { name: 'B', score: 5, unit: 'tiles' }], NOW),
    'Live now · tied at 5 tiles · 2 teams · ends in 2d 4h',
  );
  assert.equal(eventLinkDescription(event, [{ name: 'A', score: 0, unit: 'tiles' }], NOW), 'Live now · no tiles claimed yet · 1 team · ends in 2d 4h');
});

test('an upcoming board counts down, a finished one names the winner', () => {
  assert.equal(
    eventLinkDescription({ startDate: '2026-10-15 12:00:00', endDate: null, forceEndedAt: null }, [{ name: 'A', score: 0, unit: 'tiles' }], NOW),
    'Starts in 3d · 1 team ready',
  );
  assert.equal(
    eventLinkDescription(
      { startDate: '2026-10-01 12:00:00', endDate: '2026-10-08 12:00:00', forceEndedAt: null },
      [{ name: 'Iron Wolves', score: 12, unit: 'tiles' }, { name: 'B', score: 9, unit: 'tiles' }],
      NOW,
    ),
    'Finished · Iron Wolves won with 12 tiles · 2 teams',
  );
});

test('weekly gains speak the competition’s unit', () => {
  assert.equal(weeklyGain('skill', 4_820_113), '+4.82M xp');
  assert.equal(weeklyGain('boss', 212), '212 kc');
  assert.equal(weeklyGain('efficiency', 31_460), '+31.5h');
});

test('a weekly reads as a race while it runs and a result once it ends', () => {
  const live = { type: 'skill', status: 'active', startDate: '2026-10-10', endDate: '2026-10-15T00:00:00Z' };
  assert.equal(
    weeklyLinkDescription(live, 38, [{ rsn: 'Lynx Titan', gained: 4_820_113 }, { rsn: 'Zezima', gained: 1 }], NOW),
    'Lynx Titan leads with +4.82M xp · 2 members training · 2d 12h left',
  );
  assert.equal(weeklyLinkDescription(live, 38, [], NOW), 'Nobody on the board yet · 38 members training · 2d 12h left');
  const done = { type: 'boss', status: 'completed', startDate: '2026-10-01', endDate: '2026-10-08' };
  assert.equal(
    weeklyLinkDescription(done, 41, [{ rsn: 'Lynx Titan', gained: 212 }, { rsn: 'B', gained: 100 }], NOW),
    'Finished · Lynx Titan won with 212 kc · 312 kills across 2 members',
  );
});

test('a member line leads with what they are and falls back before the first sweep', () => {
  const base = { totalLevel: 2_100, combatLevel: 126, accountType: 'ironman', rank: 'Captain', isGuest: false, efficiency: { ehp: 1940.4, ehb: 0 } };
  assert.equal(memberLinkDescription(base, 'The AFK Spot'), 'Ironman · Captain of The AFK Spot · 2,100 total · 126 combat · 1,940 EHP');
  assert.equal(
    memberLinkDescription({ ...base, totalLevel: 0, isGuest: true }, 'The AFK Spot'),
    'Guest of The AFK Spot · skills, bosses, efficient hours and competition history.',
  );
});
