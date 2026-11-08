// The database-free half of the tile lab: the chat-pattern catalog and override checks
// (lib/chatPatternRules) and the replay-scenario format (lib/labScenarios).
//
// Run: npm run test:lab

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CHAT_PATTERN_CATALOG, checkOverride, testLine } from '../src/lib/chatPatternRules.ts';
import { checkScenario } from '../src/lib/labScenarios.ts';
import { withoutLabPins } from '../src/lib/labRules.ts';
import templates from '../src/data/labScenarioTemplates.json' with { type: 'json' };

test('every built-in pattern matches its own samples in JavaScript too, captures and all', () => {
  // The catalog is the plugin's; if JS cannot read a default the way Java does, the staff tester
  // would show "no match" for a line the plugin handles, and nobody would trust the tester.
  for (const entry of CHAT_PATTERN_CATALOG.patterns) {
    for (const sample of entry.samples) {
      const got = testLine(entry, entry.regex, sample.line);
      assert.notEqual(got, 'uncompilable', `${entry.key} compiles in JS`);
      assert.ok(got, `${entry.key} matches "${sample.line}"`);
      for (const [group, value] of Object.entries(sample.expect)) {
        assert.equal((got as Record<string, string>)[group], value, `${entry.key} ${group} on "${sample.line}"`);
      }
    }
  }
});

test('an override is refused for the reasons the plugin would refuse it', () => {
  assert.deepEqual(checkOverride('kc.count', 'Your (?<name>.+?) kills: (?<count>[\\d,]+)').errors, []);
  assert.match(checkOverride('nope.key', 'x').errors[0], /Unknown key/);
  assert.match(checkOverride('kc.count', 'Your (?<name>.+?) kills').errors.join(' '), /\(\?<count>/);
  assert.match(checkOverride('kc.count', `(?<name>a)(?<count>b)${'x'.repeat(600)}`).errors.join(' '), /Longer than/);
  assert.ok(checkOverride('kc.count', '(?<name>(a+)+)(?<count>\\d)').warnings.some((w) => /backtrack/.test(w)));
});

test('a reworded line is caught by an override and not by the default', () => {
  const entry = CHAT_PATTERN_CATALOG.patterns.find((p) => p.key === 'kc.count')!;
  const line = 'Vorkath kill tally: 12.';
  assert.equal(testLine(entry, entry.regex, line), null);
  assert.deepEqual(testLine(entry, '(?<name>.+?) kill tally: (?<count>[\\d,]+)', line), { name: 'Vorkath', count: '12' });
});

test('every bundled scenario passes the site check (the harness format is mirrored)', () => {
  assert.ok(templates.length > 0);
  for (const t of templates as { name: string; params?: unknown; steps: unknown }[]) {
    assert.deepEqual(checkScenario(t.name, t.steps, t.params), [], t.name);
  }
});

test('a scenario the harness would skip is refused', () => {
  assert.match(checkScenario('Bad Name', [{ wait: 1 }]).join(' '), /Name/);
  assert.match(checkScenario('ok', []).join(' '), /non-empty/);
  assert.match(checkScenario('ok', [{ wait: 1, chat: { message: 'x' } }]).join(' '), /exactly one key/);
  assert.match(checkScenario('ok', [{ teleport: {} }]).join(' '), /unknown step/);
  assert.match(checkScenario('ok', [{ loot: { kind: 'npc', name: 'X', items: [{}] } }]).join(' '), /id or a name/);
  assert.match(checkScenario('ok', [{ wait: 1 }], { kc: 5 }).join(' '), /string defaults/);
  assert.deepEqual(checkScenario('ok', [{ wait: '${t}' }, { chat: { message: 'hi ${me}' } }]), []);
});

test('a lab stat pin is not shown as a sub-out; a real bench elsewhere still is', () => {
  // lib/labStats freezes the participant who is pushing stats, so on a lab board frozenAt means
  // "pinned", and the most active member was rendering struck through as "Subbed out".
  const rows = [
    { id: 1, name: 'Drenvox', frozenAt: '2026-11-08T10:00:00.000Z' },
    { id: 2, name: 'Other', frozenAt: null },
  ];
  assert.deepEqual(withoutLabPins(rows, true).map((r) => r.frozenAt), [null, null]);
  assert.equal(rows[0].frozenAt, '2026-11-08T10:00:00.000Z', 'the input rows are not mutated');
  assert.equal(withoutLabPins(rows, false), rows, 'off the lab the rows pass through untouched');
});
