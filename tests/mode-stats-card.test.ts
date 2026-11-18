import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lacksMainStats, withModeStats } from '../src/lib/modeStatsCard.ts';
import type { PlayerCard } from '../src/lib/playerCardShape.ts';

const base = (over: Partial<PlayerCard>): PlayerCard => ({
  rsn: 'Some HCM', accountType: 'normal', clan: { slug: 'c', name: 'Clan' }, totalLevel: 33, combatLevel: 3, overallXp: null,
  ehp: null, ehb: null, statsAt: null, clog: null, latest: [], topBosses: [], skills: [], bosses: [], activities: [], clogPages: [], times: [],
  ...over,
});

test('a fresh-looking card has no main stats; a played one does', () => {
  assert.equal(lacksMainStats(base({})), true);
  assert.equal(lacksMainStats(base({ totalLevel: 0 })), true);
  assert.equal(lacksMainStats(base({ totalLevel: 500, overallXp: 2_000_000 })), false);
  assert.equal(lacksMainStats(base({ bosses: [{ key: 'zulrah', kc: 3 } as never] })), false);
});

test('mode numbers go over the card, labelled, and the rest of the card is kept', () => {
  const mode = base({ clan: null, totalLevel: 812, combatLevel: 71, overallXp: 4_000_000, skills: [{ key: 'attack', level: 60, xp: 273_742 } as never], fetchedAt: '2026-11-18T20:00:00.000Z' });
  const out = withModeStats(base({}), mode, { table: 'hardcore_mains', label: 'Hardcore Worlds' });
  assert.equal(out.totalLevel, 812);
  assert.equal(out.skills.length, 1);
  assert.deepEqual(out.clan, { slug: 'c', name: 'Clan' });
  assert.deepEqual(out.statsFrom, { table: 'hardcore_mains', label: 'Hardcore Worlds', at: '2026-11-18T20:00:00.000Z' });
});
