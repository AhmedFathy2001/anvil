// Level tiers and the gear block inside a guide body. Pure; no database.
//
// Run: npx tsx --test tests/guide-tiers.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bodyForDiscord, coverage, parseGearBlock, splitSegments, upsertGearBlock, requiresTiers } from '../src/lib/guideTiers.ts';

const FULL = [
  'Intro for everyone.',
  '::: beginner',
  'Start here.',
  '::: intermediate',
  'Middle.',
  '::: advanced',
  'Endgame.',
  ':::',
  'Shared outro.',
].join('\n');

test('segments: shared intro, three tiers, shared outro', () => {
  const segs = splitSegments(FULL);
  assert.deepEqual(
    segs.map((s) => [s.tier, s.text]),
    [
      [null, 'Intro for everyone.'],
      ['beginner', 'Start here.'],
      ['intermediate', 'Middle.'],
      ['advanced', 'Endgame.'],
      [null, 'Shared outro.'],
    ],
  );
});

test('markers inside a code fence are text', () => {
  const segs = splitSegments('```\n::: beginner\n```');
  assert.equal(segs.length, 1);
  assert.equal(segs[0].tier, null);
});

test('coverage lists what is missing, including gear setups per tier', () => {
  assert.equal(coverage(FULL).complete, true);
  const partial = coverage('::: beginner\nOnly this.');
  assert.deepEqual(partial.missing, ['Intermediate section', 'Advanced section']);
  const block = { monster: 'Vorkath#Post-quest', setups: [{ tier: 'beginner', name: 'x', gear: {}, style: 0, stats: { attack: 1, strength: 1, ranged: 1, magic: 1 } }] };
  const withGear = coverage(`${FULL}\n\`\`\`gear\n${JSON.stringify(block)}\n\`\`\``);
  assert.deepEqual(withGear.missing, ['Intermediate gear setup', 'Advanced gear setup']);
  assert.equal(requiresTiers('bossing'), true);
  assert.equal(requiresTiers('clan'), false);
});

test('gear block: parse, and replace in place', () => {
  const block = { monster: 'Zulrah', setups: [] };
  const body = upsertGearBlock('Text', block);
  assert.match(body, /```gear\n\{"monster":"Zulrah","setups":\[\]\}\n```/);
  const again = upsertGearBlock(body, { monster: 'Vorkath', setups: [] });
  assert.equal(again.match(/```gear/g)?.length, 1, 'replaced, not duplicated');
  assert.equal(parseGearBlock('not json'), null);
});

test('Discord: each level gets its own heading and message; gear is summarised', () => {
  const out = bodyForDiscord(`${FULL}\n\`\`\`gear\n{"monster":"Zulrah","setups":[]}\n\`\`\``, () => 'GEAR SUMMARY');
  assert.match(out, /Intro for everyone\.\n\n---\n## 🟢 Beginner\nStart here\./);
  assert.match(out, /---\n## 🔴 Advanced\nEndgame\./);
  assert.match(out, /Shared outro\.\n\nGEAR SUMMARY/);
  assert.ok(!out.includes(':::'));
});

import { collapseGear, expandGear } from '../src/lib/guideTiers.ts';

test('editor: the gear block shows as one line and round-trips exactly', () => {
  const body = 'Intro\n```gear\n{"monster":"Vorkath#Post-quest","setups":[]}\n```\nOutro';
  const { display, gear } = collapseGear(body);
  assert.equal(display, 'Intro\n[[⚔️ Gear progression: Vorkath — Post-quest, 0 setups · edit with the ⚔️ button]]\nOutro');
  assert.equal(expandGear(display, gear), body);
  // Text edited around it survives; deleting the line removes the block.
  assert.equal(expandGear(display.replace('Intro', 'New intro'), gear), body.replace('Intro', 'New intro'));
  assert.equal(expandGear('Intro\nOutro', gear), 'Intro\nOutro');
  assert.deepEqual(collapseGear('No gear'), { display: 'No gear', gear: null });
});
