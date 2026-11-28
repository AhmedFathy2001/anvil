import { test } from 'node:test';
import assert from 'node:assert/strict';
import { momentPlace, toaModeOf } from '@/lib/momentPlace';

test('Tombs mode comes from the raid level', () => {
  assert.equal(toaModeOf(0), 'entry');
  assert.equal(toaModeOf(149), 'entry');
  assert.equal(toaModeOf(150), 'normal');
  assert.equal(toaModeOf(540), 'expert');
  assert.deepEqual(momentPlace({ raid: 'toa', raidLevel: 540, party: 3, regionId: 14160 }),
    { regionId: 14160, raid: 'toa', raidMode: 'expert', raidLevel: 540, partySize: 3 });
});

test('Entry Mode tags and sent modes, checked per raid', () => {
  assert.equal(momentPlace({ raid: 'tob-entry' }).raidMode, 'entry');
  assert.equal(momentPlace({ raid: 'tob-entry' }).raid, 'tob');
  assert.equal(momentPlace({ raid: 'tob', raidMode: 'hard' }).raidMode, 'hard');
  assert.equal(momentPlace({ raid: 'cox', raidMode: 'cm' }).raidMode, 'cm');
  assert.equal(momentPlace({ raid: 'cox', raidMode: 'expert' }).raidMode, null);
  assert.equal(momentPlace({ raid: 'cox', raidLevel: 500 }).raidLevel, null);
});

test('Outside a raid only the region is kept, and junk is dropped', () => {
  assert.deepEqual(momentPlace({ regionId: 12850, party: 4, raidMode: 'cm' }),
    { regionId: 12850, raid: null, raidMode: null, raidLevel: null, partySize: null });
  assert.equal(momentPlace({ regionId: -1 }).regionId, null);
  assert.equal(momentPlace({ raid: 'inferno' }).raid, null);
  assert.equal(momentPlace({ raid: 'toa', raidLevel: 9999 }).raidLevel, null);
});
