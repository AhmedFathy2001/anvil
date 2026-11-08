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

/** One identity (id + token hash) held by two or more clans: a candidate for "really shared". */
export interface SharedCandidate {
  identity: string;
  clanIds: number[];
  /** One URL with this identity, for the Discord check. In memory only. */
  sampleUrl: string;
}

/** Every use of one id that two or more clans hold under at least one identity. */
export interface SharedGroup {
  webhookId: string;
  /** EVERY identity with 2+ distinct clans, each to be checked with Discord on its own. */
  candidates: SharedCandidate[];
  uses: { clanId: number; where: string; identity: string }[];
}

/** What a finding records once the scan knows which identities Discord confirmed. No token hash. */
export interface FinalFinding {
  clanIds: number[];
  uses: { clanId: number; where: string; tokenMatches: boolean }[];
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
 * The ids held by two or more DIFFERENT clans under the same identity. "The same webhook" means the
 * same id AND token: pasting another clan's id with a made-up token proves nothing. Every identity
 * with 2+ clans is a candidate and is checked on its own, so junk-token clans can't outnumber (or tie
 * and out-sort) the real holders and hide them.
 */
export function groupSharedWebhooks(uses: WebhookUse[]): SharedGroup[] {
  const byId = new Map<string, WebhookUse[]>();
  for (const u of uses) byId.set(u.webhookId, [...(byId.get(u.webhookId) ?? []), u]);
  const out: SharedGroup[] = [];
  for (const [webhookId, list] of byId) {
    const byIdentity = new Map<string, { clans: Set<number>; sampleUrl: string }>();
    for (const u of list) {
      const e = byIdentity.get(u.identity) ?? { clans: new Set<number>(), sampleUrl: u.url };
      e.clans.add(u.clanId);
      byIdentity.set(u.identity, e);
    }
    const candidates = [...byIdentity]
      .filter(([, e]) => e.clans.size >= 2)
      .map(([identity, e]) => ({ identity, clanIds: [...e.clans].sort((a, b) => a - b), sampleUrl: e.sampleUrl }))
      .sort((a, b) => a.identity.localeCompare(b.identity));
    if (candidates.length === 0) continue;
    const seen = new Set<string>();
    const shaped = list
      .filter((u) => {
        const k = `${u.clanId}|${u.where}|${u.identity}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((u) => ({ clanId: u.clanId, where: u.where, identity: u.identity }))
      .sort((a, b) => a.clanId - b.clanId || a.where.localeCompare(b.where) || a.identity.localeCompare(b.identity));
    out.push({ webhookId, candidates, uses: shaped });
  }
  return out.sort((a, b) => a.webhookId.localeCompare(b.webhookId));
}

/**
 * The finding for a group, given the identities Discord confirmed real: the clans holding a confirmed
 * identity, and every use marked by whether it holds one. Null when none was confirmed.
 */
export function finalizeGroup(group: SharedGroup, confirmed: ReadonlySet<string>): FinalFinding | null {
  const real = group.candidates.filter((c) => confirmed.has(c.identity));
  if (real.length === 0) return null;
  const clanIds = [...new Set(real.flatMap((c) => c.clanIds))].sort((a, b) => a - b);
  const seen = new Set<string>();
  const uses = group.uses
    .map((u) => ({ clanId: u.clanId, where: u.where, tokenMatches: confirmed.has(u.identity) }))
    .filter((u) => {
      const k = `${u.clanId}|${u.where}|${u.tokenMatches}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.clanId - b.clanId || a.where.localeCompare(b.where) || Number(b.tokenMatches) - Number(a.tokenMatches));
  return { clanIds, uses };
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
