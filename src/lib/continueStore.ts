// Remembering where to go back to while an XP check runs.
//
// The URL carries the return target while the person stays on the page. A check takes up to 30
// minutes and people leave, so the target is also kept in this browser, keyed by the check's attempt
// (the attempt row has no column for it and the schema is not changed). Everything here works
// without storage: every read and write is wrapped, and a page that cannot store simply has no
// "come back later" memory.

import { readContinue, type ContinueTarget } from './clanScopedPaths.ts';

const PREFIX = 'anvil.continue.';
const LATEST = `${PREFIX}latest`;
/** A remembered target older than this is forgotten (a check lasts 30 minutes; a day covers "later"). */
export const CONTINUE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function encodeEntry(c: ContinueTarget, now: number): string {
  return JSON.stringify({ next: c.next, key: c.key, at: now });
}

/** A stored entry, validated again as if it were a URL (storage is just another place to be fed). */
export function decodeEntry(raw: string | null | undefined, now: number): ContinueTarget | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { next?: unknown; key?: unknown; at?: unknown };
    if (typeof v.at !== 'number' || now - v.at > CONTINUE_MAX_AGE_MS || v.at > now + 60_000) return null;
    return readContinue({ next: typeof v.next === 'string' ? v.next : null, for: typeof v.key === 'string' ? v.key : null });
  } catch {
    return null;
  }
}

export function rememberContinue(attemptId: number, c: ContinueTarget): void {
  try {
    window.localStorage.setItem(`${PREFIX}${attemptId}`, encodeEntry(c, Date.now()));
    window.localStorage.setItem(LATEST, String(attemptId));
  } catch {
    /* no storage: the URL still carries it while they stay */
  }
}

/** The newest remembered target, if it is still fresh. */
export function recallContinue(): ContinueTarget | null {
  try {
    const id = window.localStorage.getItem(LATEST);
    if (!id || !/^\d{1,12}$/.test(id)) return null;
    return decodeEntry(window.localStorage.getItem(`${PREFIX}${id}`), Date.now());
  } catch {
    return null;
  }
}

export function forgetContinue(): void {
  try {
    const id = window.localStorage.getItem(LATEST);
    if (id && /^\d{1,12}$/.test(id)) window.localStorage.removeItem(`${PREFIX}${id}`);
    window.localStorage.removeItem(LATEST);
  } catch {
    /* nothing to forget */
  }
}

/** The return target in the address bar right now, if it has a valid one. */
export function continueFromLocation(): ContinueTarget | null {
  try {
    const p = new URLSearchParams(window.location.search);
    return readContinue({ next: p.get('next'), for: p.get('for') });
  } catch {
    return null;
  }
}

/** Page-wide signal: an XP check is on screen, so a link finishing is not "instant". */
export const XP_CHECK_EVENT = 'anvil-xp-check';
