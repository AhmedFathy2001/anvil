import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTileGrid, tileToCsvCells, TILE_CSV_COLUMNS } from '../src/lib/csvTiles.ts';
import type { Tile } from '../src/lib/types.ts';

const HEADER = ['label', 'points', 'mission', 'missionPrizes', 'missionPoints', 'missionMaxClaims', 'missionExpiryHours'];

const grid = (...rows: string[][]) => parseTileGrid([HEADER, ...rows]);

test('a prize column authors the ladder, place by place', () => {
  const { rows } = grid(['Any Zuk kill', '400', 'true', '50m|10m', '0|200', '', '']);
  const r = rows[0];
  assert.equal(r.mission, true);
  const places = r.missionRules?.reward?.places ?? [];
  assert.equal(places.length, 2);
  assert.deepEqual(places[0], { points: 0, gp: 50_000_000, unfundedPoints: null });
  assert.deepEqual(places[1], { points: 200, gp: 10_000_000, unfundedPoints: null });
});

test('a blank entry means the default, not zero', () => {
  // Gp for the top two, points for all three — the third place is points-only.
  const { rows } = grid(['Podium', '100', 'true', '20m|10m|', '300|200|100', '3', '']);
  const places = rows[0].missionRules?.reward?.places ?? [];
  assert.equal(places.length, 3);
  assert.equal(places[2].gp, 0);
  assert.equal(places[2].points, 100);
  assert.equal(rows[0].missionRules?.reward?.maxClaims, 3);
});

test('prizes are typed the way people say them', () => {
  const { rows } = grid(['Shorthand', '10', 'true', '1.5b|500k', '', '', '']);
  const places = rows[0].missionRules?.reward?.places ?? [];
  assert.equal(places[0].gp, 1_500_000_000);
  assert.equal(places[1].gp, 500_000);
  // No points column: every place keeps the tile's own value.
  assert.equal(places[0].points, null);
});

test('a prize on an unflagged row is a mission the author forgot to tick', () => {
  const { rows } = grid(['Forgot the flag', '50', '', '25m', '', '', '']);
  assert.equal(rows[0].mission, true);
  assert.equal(rows[0].missionRules?.reward?.places[0].gp, 25_000_000);
});

test('an ordinary row grows no mission rules at all', () => {
  const { rows } = grid(['Just a tile', '20', '', '', '', '', '']);
  assert.equal(rows[0].mission, false);
  assert.equal(rows[0].missionRules, undefined);
});

test('expiry alone is enough to make rules', () => {
  const { rows } = grid(['Vanishes', '20', 'true', '', '', '', '6']);
  assert.equal(rows[0].missionRules?.expiryHours, 6);
  assert.equal(rows[0].missionRules?.reward, null);
});

test('round trip: a mission exported to cells reads back the same', () => {
  const tile = {
    label: 'Any Zuk kill',
    points: 400,
    tileType: 'standard',
    mission: 1,
    rules: JSON.stringify({
      lockout: false,
      firstBonus: 0,
      decay: null,
      expiryHours: 12,
      reward: {
        places: [
          { points: 0, gp: 50_000_000, unfundedPoints: null },
          { points: 200, gp: 0, unfundedPoints: null },
        ],
        restPoints: null,
        maxClaims: 2,
      },
    }),
  } as unknown as Tile;

  const cells = tileToCsvCells(tile);
  const header = [...TILE_CSV_COLUMNS];
  const { rows } = parseTileGrid([header, cells]);
  const back = rows[0];
  assert.equal(back.mission, true);
  assert.equal(back.missionRules?.expiryHours, 12);
  assert.equal(back.missionRules?.reward?.maxClaims, 2);
  assert.deepEqual(
    back.missionRules?.reward?.places.map((p) => [p.points, p.gp]),
    [
      [0, 50_000_000],
      [200, 0],
    ],
  );
});

test('a normal tile exports blank mission cells, so ordinary sheets are unchanged', () => {
  const tile = { label: 'Plain', points: 5, tileType: 'standard' } as unknown as Tile;
  const cells = tileToCsvCells(tile);
  const header = [...TILE_CSV_COLUMNS];
  for (const col of ['mission', 'missionPrizes', 'missionPoints', 'missionMaxClaims', 'missionExpiryHours']) {
    assert.equal(cells[header.indexOf(col)], '', `${col} should be blank`);
  }
});
