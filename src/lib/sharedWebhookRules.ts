// Shared-webhook detection, the pure half (lib/sharedWebhooks does the reading and writing).
//
// The same Discord webhook id configured by two different clans is either a legitimate joint setup
// or one clan posting into another's channel. Either way staff should know, so it is raised to them.
// Compared by id AND token hash (never the raw token), and a finding is only offered for blocking once
// Discord confirms the webhook is real (lib/sharedWebhooks), so nobody can aim it at another clan.
//
// No `@/` imports so tests/shared-webhooks.test.ts runs it directly. Server-only (node:crypto).

import { webhooksIn } from './discordWebhookUrl.ts';
import { webhookIdentity } from './webhookPool.ts';

export interface WebhookUse {
  webhookId: string;
  /** id + token hash (lib/webhookPool webhookIdentity): the same webhook only when this matches. */
  identity: string;
  clanId: number;
  /** Where in the clan's setup, in words staff can act on: "Setting discord_webhook_bingo", "Event #12 channel". */
  where: string;
  /** The normalized URL, kept in memory only so the scan can ask Discord whether it is real. Never stored. */
  url: string;
}

export interface SharedGroup {
  webhookId: string;
  /** The identity two or more clans share. */
  identity: string;
  /** The clans holding that exact webhook (id AND token). */
  clanIds: number[];
  /** Every use of the id; `tokenMatches` false = another (possibly junk) token, shown apart to staff. */
  uses: { clanId: number; where: string; tokenMatches: boolean }[];
  /** One URL with the shared identity, for the Discord check. In memory only. */
  sampleUrl: string;
}

/** Every webhook id in a blob of text (a setting holding several URLs, a JSON prefs column), canonical. */
export function webhookIdsIn(text: string | null | undefined): string[] {
  return [...new Set(webhooksIn(text).map((p) => p.id))];
}

/** Every webhook use in a blob of text, for one clan and place. */
export function webhookUsesIn(text: string | null | undefined, clanId: number, where: string): WebhookUse[] {
  return webhooksIn(text).map((p) => ({ webhookId: p.id, identity: webhookIdentity(p.url), clanId, where, url: p.url }));
}

/**
 * The webhooks held by two or more DIFFERENT clans. "The same webhook" means the same id AND token:
 * pasting another clan's id with a made-up token proves nothing and must never put the real owner's
 * webhook in front of staff, so a use counts only when its identity matches. The other uses of the id
 * ride along marked `tokenMatches: false`.
 */
export function groupSharedWebhooks(uses: WebhookUse[]): SharedGroup[] {
  const byId = new Map<string, WebhookUse[]>();
  for (const u of uses) byId.set(u.webhookId, [...(byId.get(u.webhookId) ?? []), u]);
  const out: SharedGroup[] = [];
  for (const [webhookId, list] of byId) {
    const clansByIdentity = new Map<string, Set<number>>();
    for (const u of list) clansByIdentity.set(u.identity, (clansByIdentity.get(u.identity) ?? new Set()).add(u.clanId));
    let identity = '';
    let best = 0;
    for (const [ident, set] of [...clansByIdentity].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (set.size > best) [identity, best] = [ident, set.size];
    }
    if (best < 2) continue;
    const seen = new Set<string>();
    const shaped = list
      .filter((u) => {
        const k = `${u.clanId}|${u.where}|${u.identity === identity}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((u) => ({ clanId: u.clanId, where: u.where, tokenMatches: u.identity === identity }))
      .sort((a, b) => a.clanId - b.clanId || a.where.localeCompare(b.where) || Number(b.tokenMatches) - Number(a.tokenMatches));
    out.push({
      webhookId,
      identity,
      clanIds: [...clansByIdentity.get(identity)!].sort((a, b) => a - b),
      uses: shaped,
      sampleUrl: list.find((u) => u.identity === identity)!.url,
    });
  }
  return out.sort((a, b) => a.webhookId.localeCompare(b.webhookId));
}

export type FindingStatus = 'open' | 'dismissed' | 'blocked';

/**
 * A finding's status after a scan sees it shared again. A dismissed one stays dismissed unless a clan
 * that wasn't there when staff dismissed it has joined: that is a new situation, so it reopens.
 */
export function nextFindingStatus(existing: { status: string; clanIds: number[] } | null, clanIds: number[]): FindingStatus {
  if (!existing) return 'open';
  if (existing.status === 'blocked') return 'blocked';
  if (existing.status === 'dismissed') {
    const known = new Set(existing.clanIds);
    return clanIds.some((c) => !known.has(c)) ? 'open' : 'dismissed';
  }
  return 'open';
}

/** What a clan admin is told when staff block a webhook their clan used. */
export const BLOCKED_NOTICE = {
  title: 'A webhook your clan used was disabled',
  body: 'A webhook your clan used was disabled by Anvil staff: it was shared with another clan. Add a new one.',
};

/** The refusal when someone saves a blocked webhook. */
export const BLOCKED_SAVE_ERROR =
  'That Discord webhook was disabled by Anvil staff because it was shared with another clan. Make a new webhook in the channel and use that.';
