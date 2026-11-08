// The rules of a clan ownership transfer request, with no database — so they can be tested on their
// own (tests/ownership-transfer-rules.test.ts). lib/ownershipTransfers does the reading and writing.
//
// Like changing a bank PIN: the owner asks, and nothing moves for HOLD_HOURS. During the hold
//   - the owner (whoever asked) may cancel,
//   - the target may decline,
//   - Anvil platform staff may block it (with a reason), or let it through (it leaves their queue,
//     the hold still runs — staff never shorten it).
// When the hold runs out the lifecycle tick completes it, but only if the target is still an admin of
// that clan with a real (Discord-verified) login and the person who asked is still the owner;
// otherwise it is cancelled with a reason.

export const HOLD_HOURS = 72;
export const HOLD_MS = HOLD_HOURS * 3_600_000;

export const TRANSFER_STATUSES = ['pending', 'cancelled', 'declined', 'blocked', 'completed'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export type TransferAction = 'cancel' | 'decline' | 'block' | 'clear';

export interface TransferFacts {
  status: string;
  fromUserId: number;
  toUserId: number;
  completesAt: string;
  staffClearedAt?: string | null;
}

export interface TransferActor {
  userId: number;
  /** Platform staff (or root) — never a clan role. */
  isPlatformStaff: boolean;
}

/** When a request made at `requestedAt` completes. */
export function transferCompletesAt(requestedAt: Date | string | number): string {
  const ms = typeof requestedAt === 'number' ? requestedAt : new Date(requestedAt).getTime();
  return new Date(ms + HOLD_MS).toISOString();
}

/** Still pending and the hold has run out. */
export function isDue(t: Pick<TransferFacts, 'status' | 'completesAt'>, nowMs: number): boolean {
  return t.status === 'pending' && Date.parse(t.completesAt) <= nowMs;
}

export type ActionCheck = { ok: true; next: TransferStatus } | { ok: false; error: string; code: 403 | 409 };

/**
 * May this person do this to this request? Pure: who they are and what the row says.
 * A request whose hold has run out but which the tick has not completed yet may still be cancelled,
 * declined or blocked — until it is completed it has not happened.
 */
export function checkTransferAction(t: TransferFacts, actor: TransferActor, action: TransferAction): ActionCheck {
  if (t.status !== 'pending') return { ok: false, error: 'That transfer is no longer pending.', code: 409 };
  switch (action) {
    case 'cancel':
      if (actor.userId !== t.fromUserId) return { ok: false, error: 'Only the owner who asked can cancel it.', code: 403 };
      return { ok: true, next: 'cancelled' };
    case 'decline':
      if (actor.userId !== t.toUserId) return { ok: false, error: 'Only the person it is going to can decline it.', code: 403 };
      return { ok: true, next: 'declined' };
    case 'block':
      if (!actor.isPlatformStaff) return { ok: false, error: 'Only Anvil staff can block a transfer.', code: 403 };
      return { ok: true, next: 'blocked' };
    case 'clear':
      if (!actor.isPlatformStaff) return { ok: false, error: 'Only Anvil staff can review a transfer.', code: 403 };
      if (t.staffClearedAt) return { ok: false, error: 'Already let through.', code: 409 };
      // Not a status change: it stays pending and still waits out the hold.
      return { ok: true, next: 'pending' };
  }
}

export interface CompletionFacts {
  /** The target's role in this clan now, or null when they hold no grant there. */
  targetRole: string | null;
  /** The target still has a real Discord-linked login. */
  targetVerified: boolean;
  /** The requester's role in this clan now. */
  fromRole: string | null;
}

export type CompletionDecision = { complete: true } | { complete: false; reason: string };

/** At the end of the hold: move it, or say why not (and it is cancelled with that reason). */
export function completionDecision(f: CompletionFacts): CompletionDecision {
  if (f.fromRole !== 'owner') return { complete: false, reason: 'The person who asked is no longer the owner.' };
  if (f.targetRole == null) return { complete: false, reason: 'They are no longer staff of this clan.' };
  if (f.targetRole !== 'admin') return { complete: false, reason: 'They are no longer an admin of this clan.' };
  if (!f.targetVerified) return { complete: false, reason: 'Their Anvil login is no longer linked to Discord.' };
  return { complete: true };
}

/** "Mon 11 Nov, 14:00 UTC" — the moment it moves, said the same way everywhere. */
export function fmtTransferMoment(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
  return `${day}, ${time} UTC`;
}
