// Shared-webhook detection, the pure half (lib/sharedWebhooks does the reading and writing).
//
// The same Discord webhook id configured by two different clans is either a legitimate joint setup
// or one clan posting into another's channel. Either way staff should know, so it is raised to them.
// Compared by webhook id only: the id is a snowflake, not a secret, and no token is read or kept here.
//
// Pure (no `@/` imports) so tests/shared-webhooks.test.ts runs it directly.

export interface WebhookUse {
  webhookId: string;
  clanId: number;
  /** Where in the clan's setup, in words staff can act on: "Bingo channel", "Event #12 channel". */
  where: string;
}

export interface SharedGroup {
  webhookId: string;
  clanIds: number[];
  uses: { clanId: number; where: string }[];
}

const WEBHOOK_ID = /\/api\/(?:v\d+\/)?webhooks\/(\d{5,25})\//g;

/** Every webhook id in a blob of text (a setting holding several URLs, a JSON prefs column). */
export function webhookIdsIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set([...text.matchAll(WEBHOOK_ID)].map((m) => m[1]))];
}

/** The ids used by two or more DIFFERENT clans, with every use of each, in a stable order. */
export function groupSharedWebhooks(uses: WebhookUse[]): SharedGroup[] {
  const byId = new Map<string, Map<string, { clanId: number; where: string }>>();
  for (const u of uses) {
    const m = byId.get(u.webhookId) ?? new Map();
    m.set(`${u.clanId}|${u.where}`, { clanId: u.clanId, where: u.where });
    byId.set(u.webhookId, m);
  }
  const out: SharedGroup[] = [];
  for (const [webhookId, m] of byId) {
    const list = [...m.values()].sort((a, b) => a.clanId - b.clanId || a.where.localeCompare(b.where));
    const clanIds = [...new Set(list.map((u) => u.clanId))].sort((a, b) => a - b);
    if (clanIds.length >= 2) out.push({ webhookId, clanIds, uses: list });
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
