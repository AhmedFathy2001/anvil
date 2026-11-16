// What a sign-in return path is FOR, so /login can say so. Pure (no `@/` imports): the names come
// from lib/loginReason, which reads the database; this only reads the path.

import { safeReturnPath } from './safe-redirect.ts';

export type LoginTarget =
  | { kind: 'invite'; eventId: number; token: string }
  | { kind: 'event-signup'; eventId: number }
  | { kind: 'clan'; slug: string; creator: boolean }
  | { kind: 'new-clan' }
  | { kind: 'device' }
  | { kind: 'other' };

export function parseLoginTarget(returnTo: string | null | undefined): LoginTarget {
  const path = safeReturnPath(returnTo);
  const invite = /^(?:\/[cs]\/[^/?#]+)?\/events\/(\d+)\/join\/([A-Za-z0-9]{8,40})(?:[/?#]|$)/.exec(path);
  if (invite) return { kind: 'invite', eventId: Number(invite[1]), token: invite[2] };
  const signup = /^(?:\/[cs]\/[^/?#]+)?\/events\/(\d+)\/signup(?:[/?#]|$)/.exec(path);
  if (signup) return { kind: 'event-signup', eventId: Number(signup[1]) };
  if (/^\/clans\/new(?:[/?#]|$)/.test(path)) return { kind: 'new-clan' };
  if (/^\/link-device(?:[/?#]|$)/.test(path)) return { kind: 'device' };
  const clan = /^\/([cs])\/([a-z0-9-]{2,32})\/?(?:[?#]|$)/.exec(path);
  if (clan) return { kind: 'clan', slug: clan[2], creator: clan[1] === 's' };
  return { kind: 'other' };
}
