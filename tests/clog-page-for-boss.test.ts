import { test } from 'node:test';
import assert from 'node:assert/strict';

import { clogPageNames } from '../src/lib/clogDataset';
import { clogPageForBoss } from '../src/lib/clogKillcounts';

const pages = clogPageNames();

test('raid modes and grouped bosses land on their shared page', () => {
  assert.equal(clogPageForBoss('tombsOfAmascutExpertMode', pages), 'Tombs of Amascut');
  assert.equal(clogPageForBoss('chambersOfXericChallengeMode', pages), 'Chambers of Xeric');
  assert.equal(clogPageForBoss('theatreOfBloodHardMode', pages), 'Theatre of Blood');
  assert.equal(clogPageForBoss('dagannothPrime', pages), 'Dagannoth Kings');
  assert.equal(clogPageForBoss('corruptedGauntlet', pages), 'The Gauntlet');
  assert.equal(clogPageForBoss('phosanisNightmare', pages), 'The Nightmare');
});

test('a boss with its own page finds it by name, with or without "The"', () => {
  assert.equal(clogPageForBoss('vorkath', pages), 'Vorkath');
  assert.equal(clogPageForBoss('zulrah', pages), 'Zulrah');
  assert.equal(clogPageForBoss('notABoss', pages), null);
});
