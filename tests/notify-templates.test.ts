import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeTemplates,
  previewTemplate,
  renderTemplate,
  resolveTemplate,
  TEMPLATE_KINDS,
  TEMPLATE_MAX,
  TEMPLATE_SPECS,
  templateKindOf,
  templateValues,
  withTemplate,
} from '../src/lib/notifyTemplates.ts';
import { normalizeClanKinds, normalizePersonalKinds } from '../src/lib/notifyKinds.ts';
import { buildPluginEmbed } from '../src/lib/pluginEmbeds.ts';

const desc = (kind: string, facts: object) => {
  const b = buildPluginEmbed(kind, facts);
  assert.ok(b.ok, kind);
  return (b as { embed: { description?: string } }).embed.description!.split('\n')[0];
};

test('the default templates are today’s wording', () => {
  const cases: [string, object, Parameters<typeof renderTemplate>[0]][] = [
    ['quest', { rsn: 'Zezima', quest: 'Dragon Slayer II', difficulty: 'Grandmaster' }, 'quests'],
    ['level', { rsn: 'Zezima', skill: 'Slayer', level: 90, at99: 3, skills: 23 }, 'levels'],
    ['level99', { rsn: 'Zezima', skill: 'Slayer', at99: 3, skills: 23 }, 'levels'],
    ['diary', { rsn: 'Zezima', area: 'Ardougne', tier: 'Elite' }, 'diaries'],
    ['clogSlot', { rsn: 'Zezima', item: 'Dragon pickaxe' }, 'clog'],
    ['caTask', { rsn: 'Zezima', task: 'Into the Den of Giants', tier: 'Hard' }, 'ca'],
    ['pet', { rsn: 'Zezima', name: 'Olmlet' }, 'pets'],
  ];
  for (const [kind, facts, t] of cases) {
    assert.equal(renderTemplate(t, TEMPLATE_SPECS[t].def, templateValues(t, facts, null)), desc(kind, facts), kind);
  }
});

test('every kind renders its sample with no allowed placeholder left over', () => {
  for (const k of TEMPLATE_KINDS) {
    const all = Object.keys(TEMPLATE_SPECS[k].vars).map((v) => `{${v}}`).join(' ');
    const out = previewTemplate(k, all);
    for (const v of Object.keys(TEMPLATE_SPECS[k].vars)) assert.ok(!out.includes(`{${v}}`), `${k} {${v}}`);
  }
  assert.equal(previewTemplate('levels', 'GZ {player} on {level} {skill}!'), 'GZ Zezima on 99 Slayer!');
  assert.equal(previewTemplate('ge', '{player} {action} {quantity} × {item} for {value}'), 'Zezima sold 1 × Twisted bow for 1,200,000,000 gp');
  assert.equal(previewTemplate('kc', '{player}: {boss} {count}'), 'Zezima: Zulrah 500');
});

test('values come off each kind’s real facts', () => {
  assert.deepEqual(templateValues('slayer', { k: 'slayer', line: "You've completed 50 tasks and received 15 points, giving you a total of 1,234; return to a Slayer master." }, 'Z'), { player: 'Z', streak: '50', points: '1,234' });
  assert.deepEqual(templateValues('kc', { line: 'Your Zulrah kill count is: 500.' }, 'Z'), { player: 'Z', boss: 'Zulrah', count: '500' });
  assert.deepEqual(templateValues('clues', { line: 'You have completed 100 hard Treasure Trails.' }, 'Z'), { player: 'Z', tier: 'hard', count: '100' });
  assert.equal(templateValues('drops', { rsn: 'Z', source: 'Vorkath', items: [{ name: 'A', qty: 1, value: 5 }, { name: 'B', qty: 2, value: 9 }] }, null).value, '14 gp');
  assert.deepEqual(templateValues('trade', { items: [{ name: 'Coins', qty: -500 }, { name: 'Abyssal whip', qty: 1 }] }, 'Z'), { player: 'Z', gave: '500 × Coins', got: '1 × Abyssal whip' });
  assert.equal(templateKindOf('line', 'milestones', { k: 'kc' }), 'kc');
  assert.equal(templateKindOf('line', 'milestones', { k: 'custom' }), null);
  assert.equal(templateKindOf(undefined, 'pvpKills', null), 'pvp');
  assert.equal(templateKindOf('caTier', 'combatAchievements', {}), null);
  assert.equal(withTemplate('old line\nSPOONED.', 'new line'), 'new line\nSPOONED.');
});

test('unknown placeholders stay literal', () => {
  assert.equal(renderTemplate('quests', '{player} did {quest} {nope} {}', { player: 'Z', quest: 'Q' }), 'Z did Q {nope} {}');
  // Another kind's placeholder is unknown here too.
  assert.equal(renderTemplate('quests', '{player} {skill}', { player: 'Z', skill: 'Slayer' }), 'Z {skill}');
  // Deaths keep the old {name}.
  assert.equal(renderTemplate('deaths', '{name} died to {killer}', { player: 'Z', killer: 'Vorkath' }), 'Z died to Vorkath');
});

test('mentions and links are defused, in the template and in the values; length is capped', () => {
  const out = renderTemplate('levels', '@everyone <@123> <@&456> @here [click](https://evil.example) {player}', { player: '@everyone' });
  assert.ok(!/@everyone|@here/.test(out), out);
  assert.ok(!/<@&?\d+>/.test(out), out);
  assert.ok(!out.includes('https://evil.example'), out);
  assert.ok(out.includes('click'));
  // A value can't add markdown either.
  assert.equal(renderTemplate('quests', '{quest}', { quest: '**bold** [x](y)' }), '\\*\\*bold\\*\\* x');
  const long = normalizeTemplates({ levels: 'x'.repeat(500) }, 'personal').levels!;
  assert.equal(long.length, TEMPLATE_MAX);
  assert.deepEqual(normalizeTemplates({ levels: '   ', nope: 'hi', quests: 7 }, 'personal'), {});
});

test('a template resolves player, then clan default, then Anvil; private kinds are the player’s alone', () => {
  const clan = normalizeClanKinds({ templates: { levels: 'Clan: {player} {level}', ge: 'forced {item}', trade: 'x', storage: 'y' } });
  assert.deepEqual(Object.keys(clan.templates!), ['levels']);
  assert.deepEqual(resolveTemplate('levels', {}, clan.templates), { template: 'Clan: {player} {level}', source: 'clan' });
  const me = normalizePersonalKinds({ templates: { levels: 'Mine: {player}' } });
  assert.deepEqual(resolveTemplate('levels', me.templates, clan.templates), { template: 'Mine: {player}', source: 'custom' });
  // Reset = removed from the player's settings: back to the clan's.
  assert.equal(resolveTemplate('levels', normalizePersonalKinds({ templates: {} }).templates, clan.templates).source, 'clan');
  assert.deepEqual(resolveTemplate('quests', {}, {}), { template: TEMPLATE_SPECS.quests.def, source: 'platform' });
  // A forged clan GE template is never read.
  assert.equal(resolveTemplate('ge', {}, { ge: 'forced' } as never).source, 'platform');
  assert.equal(resolveTemplate('ge', { ge: 'mine {item}' }, { ge: 'forced' } as never).template, 'mine {item}');
});
