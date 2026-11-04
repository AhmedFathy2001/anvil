// Medal.tv — the one API read Anvil makes. No database import (tests/connected-accounts.test.ts).
//
// WHAT MEDAL OFFERS (checked 2026-11):
//   - No OAuth / "Sign in with Medal". docs.medal.tv now redirects to the auto-clipping SDK pages
//     (medal.tv/developer/auto-clipping), which are about a GAME telling the local Medal app to save a
//     clip — nothing about reading a person's profile.
//   - The legacy public read API is still up: GET https://developers.medal.tv/v1/latest?userId=…&limit=…
//     with `Authorization: <api key>` (401 "The Authorization header was not found" without one). It
//     lists a user's latest PUBLIC clips (contentTitle, credits "Credits to Name (https://medal.tv/users/ID)",
//     directClipUrl …). There is no lookup by username and no profile/bio endpoint.
//
// So a Medal link is verified by a code in a CLIP TITLE: the person renames (or uploads) one public
// clip with their Anvil code in the title, presses Verify, and Anvil reads their latest clips back.
// Only the Medal account's owner can title its clips. The host is fixed — nothing user-supplied is
// ever fetched.
//
// CONFIGURED = MEDAL_API_KEY. Without it Medal links can still be added, as clearly-labelled
// unverified display links.

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const LATEST = 'https://developers.medal.tv/v1/latest';

export function medalApiKey(env: Record<string, string | undefined> = process.env): string | null {
  const k = env.MEDAL_API_KEY?.trim();
  return k && k.length >= 8 && k.length <= 200 && /^[A-Za-z0-9_.-]+$/.test(k) ? k : null;
}

export interface MedalClip {
  title: string;
  credits: string;
}

export type MedalResult<T> = { ok: true; value: T } | { ok: false; reason: 'unauthorized' | 'error' | 'not-found' };

/** The user's latest public clips (at most `limit`, ≤ 25). */
export async function latestClips(apiKey: string, medalUserId: string, limit = 10, f: FetchLike = fetch): Promise<MedalResult<MedalClip[]>> {
  if (!/^[0-9]{1,15}$/.test(medalUserId)) return { ok: false, reason: 'not-found' };
  const q = new URLSearchParams({ userId: medalUserId, limit: String(Math.min(Math.max(1, limit), 25)) });
  let res: Response;
  try {
    res = await f(`${LATEST}?${q}`, { headers: { Authorization: apiKey, Accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, reason: 'error' };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, reason: 'unauthorized' };
  if (res.status === 404) return { ok: false, reason: 'not-found' };
  if (!res.ok) return { ok: false, reason: 'error' };
  const j = (await res.json().catch(() => null)) as { contentObjects?: unknown } | null;
  const items = Array.isArray(j?.contentObjects) ? j!.contentObjects.slice(0, 25) : [];
  return {
    ok: true,
    value: items.map((c) => {
      const o = (c ?? {}) as { contentTitle?: unknown; credits?: unknown };
      return {
        title: typeof o.contentTitle === 'string' ? o.contentTitle.slice(0, 500) : '',
        credits: typeof o.credits === 'string' ? o.credits.slice(0, 500) : '',
      };
    }),
  };
}
