// The same Discord webhook id set up by more than one clan (lib/sharedWebhookRules): finding the ids,
// grouping them by clan, and how a finding's status moves when it is seen again.
//
// Run: npx tsx --test tests/shared-webhooks.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { finalizeGroup, groupSharedWebhooks, nextFindingStatus, webhookIdsIn, webhookUsesIn } from '../src/lib/sharedWebhookRules.ts';
import { normalizeDiscordWebhookUrl, normalizeWebhookList, parseDiscordWebhook } from '../src/lib/discordWebhookUrl.ts';
import { webhookIdOf, webhookIdentity } from '../src/lib/webhookPool.ts';

test('ids come out of a setting list and a JSON prefs blob; tokens are never part of them', () => {
  const list = 'https://discord.com/api/webhooks/111111/tokA https://discordapp.com/api/v10/webhooks/222222/tokB,https://discord.com/api/webhooks/111111/other';
  assert.deepEqual(webhookIdsIn(list), ['111111', '222222']);
  assert.deepEqual(webhookIdsIn(JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/333333/t', extraWebhookUrls: ['https://discord.com/api/webhooks/444444/u'] })), ['333333', '444444']);
  assert.deepEqual(webhookIdsIn('https://example.com/not/a/webhook'), []);
  assert.deepEqual(webhookIdsIn(null), []);
});

const R = 'https://discord.com/api/webhooks/111111/realToken';
const use = (clanId: number, where: string, url: string) => webhookUsesIn(url, clanId, where)[0];

test('only a webhook (id AND token) held by two DIFFERENT clans is shared; one clan using it twice is not', () => {
  const groups = groupSharedWebhooks([
    use(2, 'Setting discord_webhook_bingo', R),
    use(1, 'Setting discord_webhook_url', R),
    use(1, 'Setting discord_webhook_url', R),
    use(3, 'Setting discord_webhook_url', 'https://discord.com/api/webhooks/222222/t'),
    use(3, 'Event #4 channel', 'https://discord.com/api/webhooks/222222/t'),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].webhookId, '111111');
  assert.equal(groups[0].candidates.length, 1);
  assert.deepEqual(groups[0].candidates[0].clanIds, [1, 2]);
  const f = finalizeGroup(groups[0], new Set([groups[0].candidates[0].identity]));
  assert.deepEqual(f, {
    clanIds: [1, 2],
    uses: [
      { clanId: 1, where: 'Setting discord_webhook_url', tokenMatches: true },
      { clanId: 2, where: 'Setting discord_webhook_bingo', tokenMatches: true },
    ],
  });
  assert.ok(!JSON.stringify(f).includes('realToken'), 'what gets stored carries no token');
  assert.equal(finalizeGroup(groups[0], new Set()), null, 'nothing confirmed, no finding');
});

test('a junk-token paste of a real id raises nothing; beside a real share it is shown apart', () => {
  // Clan 9 pastes clan 1's webhook id with a made-up token: not the same webhook.
  assert.deepEqual(groupSharedWebhooks([use(1, 'Setting discord_webhook_url', R), use(9, 'Setting discord_webhook_url', 'https://discord.com/api/webhooks/111111/junk')]), []);
  const [g] = groupSharedWebhooks([
    use(1, 'Setting discord_webhook_url', R),
    use(2, 'Setting discord_webhook_bingo', R),
    use(9, 'Setting discord_webhook_url', 'https://discord.com/api/webhooks/111111/junk'),
  ]);
  const f = finalizeGroup(g, new Set([webhookIdentity(R)]))!;
  assert.deepEqual(f.clanIds, [1, 2], 'the junk paster is not one of the clans');
  assert.deepEqual(f.uses.find((u) => u.clanId === 9), { clanId: 9, where: 'Setting discord_webhook_url', tokenMatches: false });
});

test('junk-token clans outnumbering the real holders can not hide them: every 2+ identity is a candidate', () => {
  const JUNK = 'https://discord.com/api/webhooks/111111/junk';
  const [g] = groupSharedWebhooks([
    use(1, 'a', R),
    use(2, 'a', R),
    use(7, 'a', JUNK),
    use(8, 'a', JUNK),
    use(9, 'a', JUNK),
  ]);
  assert.equal(g.candidates.length, 2, 'both identities are checked, not just the bigger one');
  // Discord confirms only the real token: the finding is the real holders.
  const f = finalizeGroup(g, new Set([webhookIdentity(R)]))!;
  assert.deepEqual(f.clanIds, [1, 2]);
  assert.deepEqual(f.uses.filter((u) => !u.tokenMatches).map((u) => u.clanId), [7, 8, 9]);
});

test('a leading-zero id is the same webhook as the plain one, everywhere', () => {
  const plain = 'https://discord.com/api/webhooks/111111/realToken';
  const padded = 'https://discord.com/api/webhooks/000111111/realToken';
  assert.equal(parseDiscordWebhook(padded)?.id, '111111');
  assert.equal(normalizeDiscordWebhookUrl(padded), plain);
  assert.deepEqual(webhookIdsIn(padded), ['111111']);
  assert.equal(webhookIdOf(padded), '111111');
  assert.equal(webhookIdentity(padded), webhookIdentity(plain));
  const [g] = groupSharedWebhooks([use(1, 'a', plain), use(2, 'b', padded)]);
  assert.deepEqual(g.candidates.map((c) => c.clanIds), [[1, 2]]);
});

test('variants that could parse differently elsewhere are refused, not guessed at', () => {
  for (const bad of [
    'https://discord.com/api/webhooks/%31%31/tok',
    'https://discord.com/api/webhooks/111/to%6Bk',
    'https://user:pw@discord.com/api/webhooks/111/tok',
    'https://discord.com:8443/api/webhooks/111/tok',
    'https://discord.com.evil.example/api/webhooks/111/tok',
    'https://discord.com/api/webhooks/0/tok',
    'https://discord.com/api/webhooks/99999999999999999999999/tok',
    'https://discord.com/api/webhooks/111/tok/extra',
    'https://discord.com/api/webhooks/111/tok?wait=true',
    'https://discord.com/api/webhooks/111/tok/messages/5',
  ]) {
    assert.equal(parseDiscordWebhook(bad), null, bad);
  }
  // The senders' form may address a message and carry a query, and fetches the normalized URL.
  assert.equal(
    parseDiscordWebhook('https://discordapp.com/api/v10/webhooks/0111/tok/messages/5?wait=true', { target: true })?.requestUrl,
    'https://discord.com/api/webhooks/111/tok/messages/5?wait=true',
  );
  assert.equal(normalizeWebhookList('https://discord.com/api/webhooks/0111/a, https://discord.com/api/webhooks/111/a https://discord.com/api/webhooks/2222/b'), 'https://discord.com/api/webhooks/111/a https://discord.com/api/webhooks/2222/b');
  assert.equal(normalizeWebhookList('https://discord.com/api/webhooks/111/a https://example.com/x'), null);
});

test('a forum thread_id (and only that) survives normalization, canonical; anything else is refused', () => {
  const base = 'https://discord.com/api/webhooks/111/tok';
  assert.equal(normalizeDiscordWebhookUrl(`${base}?thread_id=0042`), `${base}?thread_id=42`);
  assert.equal(parseDiscordWebhook(`${base}?thread_id=42`)?.threadId, '42');
  assert.equal(normalizeWebhookList(`${base}?thread_id=42 https://discord.com/api/webhooks/0222/b`), `${base}?thread_id=42 https://discord.com/api/webhooks/222/b`);
  for (const bad of [`${base}?thread_id=abc`, `${base}?thread_id=1&wait=true`, `${base}?thread_id=1&thread_id=2`, `${base}?thread_id=0`, `${base}?foo=1`]) {
    assert.equal(normalizeDiscordWebhookUrl(bad), null, bad);
  }
  // Same webhook, thread or not: one identity, one id.
  assert.equal(webhookIdentity(`${base}?thread_id=42`), webhookIdentity(base));
  // A sender adding ?wait=true keeps the thread.
  assert.equal(
    parseDiscordWebhook(`${base}?thread_id=42&wait=true`, { target: true })?.requestUrl,
    `${base}?thread_id=42&wait=true`,
  );
});

test('status: new is open; dismissed stays dismissed unless a new clan joins; blocked stays blocked', () => {
  assert.equal(nextFindingStatus(null, [1, 2]), 'open');
  assert.equal(nextFindingStatus({ status: 'dismissed', clanIds: [1, 2] }, [1, 2]), 'dismissed');
  assert.equal(nextFindingStatus({ status: 'dismissed', clanIds: [1, 2] }, [1]), 'dismissed');
  assert.equal(nextFindingStatus({ status: 'dismissed', clanIds: [1, 2] }, [1, 2, 3]), 'open');
  assert.equal(nextFindingStatus({ status: 'blocked', clanIds: [1, 2] }, [1, 2, 3]), 'blocked');
  assert.equal(nextFindingStatus({ status: 'open', clanIds: [1, 2] }, [1, 2]), 'open');
});

test('the staff routes read for support and act for staff only', () => {
  const src = readFileSync(join(process.cwd(), 'src/app/api/staff/shared-webhooks/route.ts'), 'utf-8');
  const get = src.slice(src.indexOf('export async function GET'), src.indexOf('export async function POST'));
  const post = src.slice(src.indexOf('export async function POST'));
  assert.match(get, /requirePlatformApi\('support'\)/);
  assert.match(get, /if \('response' in gate\) return gate\.response;/);
  assert.match(post, /requirePlatformApi\(CAN_WRITE\)/);
  assert.match(post, /if \('response' in gate\) return gate\.response;/);
  const page = readFileSync(join(process.cwd(), 'src/app/staff/webhooks/page.tsx'), 'utf-8');
  assert.match(page, /requirePlatformPage\('support'\)/);
  assert.match(page, /hasPlatformRole\(actor\?\.role, 'staff'\)/);
});
