// The same Discord webhook id set up by more than one clan (lib/sharedWebhookRules): finding the ids,
// grouping them by clan, and how a finding's status moves when it is seen again.
//
// Run: npx tsx --test tests/shared-webhooks.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { groupSharedWebhooks, nextFindingStatus, webhookIdsIn } from '../src/lib/sharedWebhookRules.ts';

test('ids come out of a setting list and a JSON prefs blob; tokens are never part of them', () => {
  const list = 'https://discord.com/api/webhooks/111111/tokA https://discordapp.com/api/v10/webhooks/222222/tokB,https://discord.com/api/webhooks/111111/other';
  assert.deepEqual(webhookIdsIn(list), ['111111', '222222']);
  assert.deepEqual(webhookIdsIn(JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/333333/t', extraWebhookUrls: ['https://discord.com/api/webhooks/444444/u'] })), ['333333', '444444']);
  assert.deepEqual(webhookIdsIn('https://example.com/not/a/webhook'), []);
  assert.deepEqual(webhookIdsIn(null), []);
});

test('only ids used by two DIFFERENT clans are shared; one clan using it twice is not', () => {
  const groups = groupSharedWebhooks([
    { webhookId: '111111', clanId: 2, where: 'Setting discord_webhook_bingo' },
    { webhookId: '111111', clanId: 1, where: 'Setting discord_webhook_url' },
    { webhookId: '111111', clanId: 1, where: 'Setting discord_webhook_url' },
    { webhookId: '222222', clanId: 3, where: 'Setting discord_webhook_url' },
    { webhookId: '222222', clanId: 3, where: 'Event #4 channel' },
  ]);
  assert.deepEqual(groups, [
    {
      webhookId: '111111',
      clanIds: [1, 2],
      uses: [
        { clanId: 1, where: 'Setting discord_webhook_url' },
        { clanId: 2, where: 'Setting discord_webhook_bingo' },
      ],
    },
  ]);
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
