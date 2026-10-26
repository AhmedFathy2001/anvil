import { verifyPluginToken, verifyPluginTokenForEvent, verifyPluginTokenUser } from '@/lib/auth';
import { rateLimitByKey } from '@/lib/rate-limit';

/**
 * Who is claiming a tile from the plugin, and on which team. The token names the account, which names
 * the event and the team; nothing about the team is taken from the request, so a client can only ever
 * claim on its own team. Shared by /api/plugin/claims and the panel's claim actions (lib/pluginUi).
 */
export async function pluginClaimCaller(
  request: Request,
  eventId?: number,
): Promise<
  | { ok: true; auth: { eventId: number; teamId: number; playerId: number }; userId: number }
  | { ok: false; error: string; status: number }
> {
  const auth = eventId != null ? await verifyPluginTokenForEvent(request, eventId) : await verifyPluginToken(request);
  if (!auth) return { ok: false, error: 'Unauthorized. Provide Authorization: Bearer <accountToken>', status: 401 };
  // A token minted before logins were linked can resolve the account but not the login. The claim is
  // a person's, so fall back to the token's own user; refuse rather than invent one.
  const userId = auth.userId ?? (await verifyPluginTokenUser(request))?.userId ?? null;
  if (userId == null) return { ok: false, error: 'Sign in to the site once to link this account.', status: 403 };
  const rl = await rateLimitByKey('tile-claims', `${userId}:${auth.teamId}`, { limit: 30, windowMs: 60_000 });
  if (!rl.ok) return { ok: false, error: 'Slow down a moment and try again.', status: 429 };
  return { ok: true, auth, userId };
}
