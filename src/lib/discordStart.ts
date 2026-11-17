import { safeReturnPath } from './safe-redirect.ts';

/** The Discord sign-in start, coming back to `returnTo`: the same link /login's button uses. */
export function discordStartHref(returnTo: string): string {
  return `/api/auth/discord/start?return=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
