import test from 'node:test';
import assert from 'node:assert/strict';
import { hasChatTags, stripChatTags, stripChatTagsDeep } from '../src/lib/chatTags.ts';
import { caTask, caFacts } from '../src/lib/moments.ts';

// The server-side half of the @ach_comp@ fix. The plugin strips these now too, but a hub release
// reaches players on the plugin-hub's schedule and every installed client keeps sending the raw
// string until then — so this is what makes a post read right today.

test('strips both styling forms and leaves ordinary text alone', () => {
  assert.equal(stripChatTags('<col=ff0000>Whack-a-Mole</col>'), 'Whack-a-Mole');
  assert.equal(stripChatTags('@ach_comp@Phantom Muspah Speed-Chaser'), 'Phantom Muspah Speed-Chaser');
  assert.equal(stripChatTags('@red@Spooned@whi@'), 'Spooned');
  // One @ is not a code — it takes a closing one, close behind, to be styling.
  assert.equal(stripChatTags('me@home'), 'me@home');
  assert.equal(stripChatTags('Phantom Muspah'), 'Phantom Muspah');
});

test('stripping is idempotent, so both sides of the wire doing it is not a conflict', () => {
  const once = stripChatTags('@ach_comp@Whack-a-Mole');
  assert.equal(stripChatTags(once), once);
});

test('non-strings pass through untouched', () => {
  assert.equal(stripChatTags(undefined), undefined);
  assert.equal(stripChatTags(null), null);
  assert.equal(stripChatTags(42), 42);
});

test('hasChatTags finds what the cleanup pass has to rewrite', () => {
  // Regex state must not leak between calls — the same input twice is the same answer.
  assert.equal(hasChatTags('@ach_comp@Whack-a-Mole'), true);
  assert.equal(hasChatTags('@ach_comp@Whack-a-Mole'), true);
  assert.equal(hasChatTags('Whack-a-Mole'), false);
  assert.equal(hasChatTags('Whack-a-Mole'), false);
});

test('a whole embed is cleaned without the relay knowing its shape', () => {
  const embed = stripChatTagsDeep({
    title: '⚔️ @ach_comp@Phantom Muspah Speed-Chaser',
    description: 'Minjoll completed a master combat task.',
    url: 'https://oldschool.runescape.wiki/w/@ach_comp@Phantom_Muspah_Speed-Chaser',
    fields: [{ name: 'Points earned', value: '`+5`' }],
    color: 16766720,
  });
  assert.equal(embed.title, '⚔️ Phantom Muspah Speed-Chaser');
  // The wiki link was built from the polluted name, so it pointed at a page that doesn't exist.
  assert.equal(embed.url, 'https://oldschool.runescape.wiki/w/Phantom_Muspah_Speed-Chaser');
  assert.deepEqual(embed.fields, [{ name: 'Points earned', value: '`+5`' }]);
  assert.equal(embed.color, 16766720);
});

test('a cleaned task name is one our own dataset can place again', () => {
  // This is the part that was not cosmetic: the feed reads the tier and the boss out of
  // combatAchievements.json BY NAME, so a styled name had no tier and no boss to be judged by.
  assert.equal(caTask('@ach_comp@Whack-a-Mole'), null);
  const cleaned = caTask(stripChatTags('@ach_comp@Whack-a-Mole'));
  assert.ok(cleaned, 'Whack-a-Mole should be in the CA dataset');
  assert.equal(cleaned.tier, 'Hard');

  // And with it placed, the moment is judged on OUR tier rather than falling back to the client's.
  const facts = caFacts({
    kind: 'ca',
    taskName: stripChatTags('@ach_comp@Whack-a-Mole'),
    tier: 'Master', // a client that got the tier wrong no longer decides
    occurredAt: new Date().toISOString(),
    dedupKey: 'x',
  });
  assert.equal(facts.tier, 'Hard');
  assert.ok(facts.monster);
});
