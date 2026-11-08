/**
 * CREDIT FIRST, PROOF AFTER — the pure half (no database; lib/proofFinish is the other).
 *
 * A current plugin files a screenshot-worthy credit with no image (`proofPending: true` on
 * POST /api/plugin/facts), so "Submitted" and "Tile complete" reach the game at once, and uploads the
 * dual-frame proof moments later (POST /api/plugin/facts/proof) under the `proofKey` the credit reply
 * named. A row still waiting PROOF_WINDOW_MS after it was filed is reversed (lib/proofFinish
 * sweepOverdueProofs), so a credit can never keep its count without its screenshot.
 */
import crypto from 'crypto';

import { gameLines, parseProofClaims, type ProofClaims } from '@/lib/proofStamp';

/** How long a credit waits for its screenshot before it is reversed. */
export const PROOF_WINDOW_MS = 60_000;

/** What the plugin reads when it was too late. */
export const PROOF_TOO_LATE = "Too late — the credit was reversed because the screenshot didn't arrive in time";

/** Why a reversed credit was removed (the removal's audit reason). */
export const PROOF_REVERSAL_REASON = 'No screenshot arrived within a minute';

/** A fresh opaque key: 144 random bits, url-safe. */
export function newProofKey(): string {
  return crypto.randomBytes(18).toString('base64url');
}

/** A key as a client may send it back, or null. Client-supplied, so shape-checked before any query. */
export function parseProofKey(raw: unknown): string | null {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(raw) ? raw : null;
}

/**
 * What an ATTACHED row keeps in place of its key: a one-way tombstone, so a repeat upload of the same
 * screenshot (the plugin never heard the first answer) is still answered ok — while the key itself is
 * gone and nothing can be attached with it again.
 */
export function attachedKeyMark(key: string): string {
  return `done:${crypto.createHash('sha256').update(key).digest('base64url')}`;
}

/** When a credit filed at `filedAt` (epoch ms) is reversed, as stored (ISO). */
export function proofDueAt(filedAt: number): string {
  return new Date(filedAt + PROOF_WINDOW_MS).toISOString();
}

/** Has this row's window closed? A row with no due time never waited. */
export function proofOverdue(dueAt: string | null | undefined, now: number): boolean {
  if (!dueAt) return false;
  const t = Date.parse(dueAt);
  return Number.isFinite(t) && t <= now;
}

/** What a waiting row keeps for its stamp and Discord post (submissions.proof_pending). */
export interface PendingProof {
  /** The banner's claims as the credit request sent them (title/detail per credit). */
  claims: ProofClaims | null;
  /** When the credit was received (the stamp's server time). */
  receivedAt: number;
  /** This credit finished the tile. */
  completed: boolean;
  /** A clog row that replaced the live unlock push's bare row (already announced). */
  superseded: boolean;
  /** A cap counter row (no post of its own). */
  cap: boolean;
  rsn: string | null;
  /** The clan address the credit was filed under (x-anvil-clan-slug), so the upload is checked the same way. */
  clan: string | null;
  /** The board tile whose completion announcements this credit held (lib/submissions announceHeldCompletion). */
  announce: number | null;
  /** The plugin user who filed it: the team-progress line's sender. */
  sender: number | null;
}

export function encodePendingProof(p: PendingProof): string {
  return JSON.stringify({ ...p, claims: p.claims ? stampOnlyClaims(p.claims) : null });
}

/**
 * The claims with only the chat lines the stamp would print (game messages around the credit's tick,
 * lib/proofStamp gameLines) — the rest of the player's chat is never stored while a credit waits.
 */
export function stampOnlyClaims(claims: ProofClaims): ProofClaims {
  return { ...claims, chat: claims.chat.filter((c) => gameLines({ ...claims, chat: [c] }).length > 0) };
}

/** A submission row as any API may show it: the waiting-proof bookkeeping (key, stored claims) never leaves. */
export function publicSubmission<T extends { proofKey?: unknown; proofPending?: unknown }>(row: T): Omit<T, 'proofKey' | 'proofPending'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { proofKey, proofPending, ...rest } = row;
  return rest;
}

/** The stored JSON back, tolerant of anything malformed (a missing stamp never costs a credit). */
export function decodePendingProof(raw: string | null | undefined): PendingProof {
  let o: Record<string, unknown> = {};
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) o = parsed as Record<string, unknown>;
  } catch {
    // fall through to the defaults
  }
  return {
    claims: o.claims ? parseProofClaims(o.claims) : null,
    receivedAt: typeof o.receivedAt === 'number' && Number.isFinite(o.receivedAt) ? o.receivedAt : Date.now(),
    completed: o.completed === true,
    superseded: o.superseded === true,
    cap: o.cap === true,
    rsn: typeof o.rsn === 'string' ? o.rsn.slice(0, 12) : null,
    announce: Number.isInteger(o.announce) ? (o.announce as number) : null,
    sender: Number.isInteger(o.sender) ? (o.sender as number) : null,
    clan: typeof o.clan === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(o.clan) ? o.clan : null,
  };
}

/**
 * The claims to stamp with: the ones filed with the credit, with the frame split the upload reports
 * (only the uploader knows where its two stacked frames meet). Nothing else from the upload is taken:
 * the banner's words were settled when the credit was filed.
 */
export function claimsWithSplit(claims: ProofClaims | null, upload: unknown): ProofClaims | null {
  if (!claims) return null;
  const split = parseProofClaims(upload)?.split ?? null;
  return split != null ? { ...claims, split } : claims;
}
