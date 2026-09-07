// Which clan was this failing request for?
//
// Split from lib/errorEvents so the recorder stays a recorder. The answer has to come from the
// REQUEST — `onRequestError` runs after the request context is gone, so `currentClan()` and every
// other `headers()`-based helper is unavailable by then, and a lookup that guessed would file one
// clan's outage under another's name.
//
// Resolution mirrors lib/clanContext exactly, and for the same reasons: the path is canonical, the
// legacy per-clan host is the fallback, and neither is trusted — both are only ever used as a lookup
// key against a closed set, so an unrecognised value resolves to null rather than to something.
//
// NULL IS A REAL ANSWER, not a failure. The apex has no clan, and a request that died before one
// could be resolved genuinely belongs to none.

import { resolveClanByHost, resolveClanBySlug } from '@/lib/clanContext';

/** The `/c/<slug>` prefix a path carries, if any. Same shape the proxy matches on. */
function slugFromPath(path: string): string | null {
  return /^\/c\/([a-z0-9-]{2,32})(?=\/|$)/.exec(path)?.[1] ?? null;
}

function firstHeader(headers: NodeJS.Dict<string | string[]>, name: string): string | null {
  const raw = headers[name];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

/**
 * Best-effort clan id for a failed request. Never throws — a lookup that fails during error
 * recording must not become the reason the error goes unrecorded.
 */
export async function clanIdForError(
  headers: NodeJS.Dict<string | string[]>,
  path: string,
): Promise<number | null> {
  try {
    // The path first, exactly as currentClan does: on a clan-prefixed request that is what the
    // person typed. `onRequestError` reports the ORIGINAL path with the prefix still on it — checked
    // against a running server, because the proxy rewrites it away before routing and it would have
    // been equally plausible for the rewritten one to arrive here. The header is the fallback for a
    // failure raised after the rewrite, where only middleware's copy of the slug survives.
    const fromPath = slugFromPath(path) ?? firstHeader(headers, 'x-anvil-clan-slug');
    if (fromPath) {
      const clan = await resolveClanBySlug(fromPath);
      if (clan) return clan.id;
    }
    const clan = await resolveClanByHost(firstHeader(headers, 'host'));
    return clan?.id ?? null;
  } catch {
    return null;
  }
}
