// A plugin token can do NOTHING for a character its login doesn't own.
//
// The Account Token names a LOGIN; X-RSN / X-Account-Hash name the CHARACTER being played. When the
// two don't belong together — the character is somebody else's, this login said "Not my account",
// or it isn't linked to this login at all — nothing the plugin sends may land on Anvil for it: no
// submission, proof, claim, drop, Discord post, stat, log or panel action, attributed neither to the
// character nor to the token's login. Reads about the login itself (its own feed, profile) are fine.
//
// Most plugin writes already resolve the character through resolvePluginMember (an OWNED seat) or
// resolvePluginCharacter (an owned character), which can only ever return this login's own, so a
// foreign character already fails there — this module gives those failures one clear answer.
// The few routes that fall back to the token's LOGIN (clip, notify, clan-sync, hello, weekly enrol,
// the panel's actions) ask {@link pluginCharacterRefusal} up front instead.

import { NextResponse } from 'next/server';

import { normalizeRsn, resolvePluginMember, verifyPluginTokenUser } from '@/lib/auth';
import { accountStanding, playedCharacter, type PlayedCharacter } from '@/lib/pluginAccount';

export const FOREIGN_CHARACTER_MESSAGE = 'This character belongs to another Anvil player — nothing is sent for it.';
export const IGNORED_CHARACTER_MESSAGE = 'You marked this character as not yours — nothing is sent for it.';
export const UNLINKED_CHARACTER_MESSAGE = 'This character isn’t linked to your Anvil account — nothing is sent for it.';

export type CharacterRefusal = {
  reason: 'foreign-character' | 'ignored-character' | 'unlinked-character';
  error: string;
};

type RefusalOpts = { allowUnclaimed?: boolean; rsn?: string | null; accountHash?: string | null };

/**
 * Why this request may not act for the character it names, or null when it may (the character is
 * this login's own) or when it names none (no token, or no X-RSN: then it is the login acting as
 * itself, which the route judges on its own).
 *
 * `allowUnclaimed`: a character nobody has claimed yet passes — for the few acts that are the
 * login's own rather than the character's (a reaction, "I'm going") or that only ever ASK
 * (hello's seat request). Everything that would credit or post as the character leaves it off.
 * An unclaimed character first gets the normal auto-link a config poll would give it, so a
 * newcomer's first write isn't refused for being a few seconds early.
 *
 * `rsn` / `accountHash`: the character named in the body rather than the headers (hello, weekly
 * enrol, clan sync's local player).
 */
export async function pluginCharacterRefusal(
  request: Request,
  opts: RefusalOpts = {},
): Promise<CharacterRefusal | null> {
  if (!request.headers.get('Authorization')?.startsWith('Bearer ')) return null;
  const viewer = await verifyPluginTokenUser(request);
  if (!viewer) return null;
  const character = characterOf(request, opts.rsn, opts.accountHash);
  if (!character) return null;

  // The hash is client-supplied: it may REFUSE, never ALLOW on its own. The NAME is judged too, so a
  // hash borrowed from one of this login's own characters can't pass for somebody else's.
  const [byHashOrName, byName] = await Promise.all([
    accountStanding(viewer.userId, character),
    character.accountHash ? accountStanding(viewer.userId, { ...character, accountHash: null }) : null,
  ]);
  let standing = byHashOrName;
  if (standing === 'unclaimed' && !opts.allowUnclaimed && character.rsnNormalized === playedCharacter(request)?.rsnNormalized) {
    // The same link a config poll makes (and nothing more when it isn't allowed).
    await resolvePluginMember(request).catch(() => null);
    standing = await accountStanding(viewer.userId, character);
  }
  // A character by this name that somebody else owns is theirs, whatever hash came with it.
  if (byName === 'other') standing = 'other';
  switch (standing) {
    case 'yours':
      return null;
    case 'other':
      return { reason: 'foreign-character', error: FOREIGN_CHARACTER_MESSAGE };
    case 'ignored':
      return { reason: 'ignored-character', error: IGNORED_CHARACTER_MESSAGE };
    default:
      return opts.allowUnclaimed ? null : { reason: 'unlinked-character', error: UNLINKED_CHARACTER_MESSAGE };
  }
}

function characterOf(request: Request, rsn: string | null | undefined, hash: string | null | undefined): PlayedCharacter | null {
  const played = playedCharacter(request);
  if (rsn == null) return played;
  const rsnNormalized = normalizeRsn(rsn);
  if (!rsnNormalized) return played;
  // X-Account-Hash only vouches for the character X-RSN names.
  const accountHash = hash?.trim() || (played && played.rsnNormalized === rsnNormalized ? played.accountHash : null);
  return { rsn: rsn.trim(), rsnNormalized, accountHash };
}

export function refusalResponse(r: CharacterRefusal): NextResponse {
  return NextResponse.json({ error: r.error, reason: r.reason, refused: true }, { status: 403 });
}

/** Up front: the 403 to return, or null to carry on. */
export async function refuseForeignCharacter(
  request: Request,
  opts: RefusalOpts = {},
): Promise<NextResponse | null> {
  const r = await pluginCharacterRefusal(request, opts);
  return r ? refusalResponse(r) : null;
}

/**
 * For a route whose owner-checked resolution already failed: say it was the character, when it
 * was, instead of the route's generic "Unauthorized". Costs nothing on the happy path.
 */
export async function foreignOr(request: Request, fallback: NextResponse | (() => NextResponse)): Promise<NextResponse> {
  const r = await pluginCharacterRefusal(request).catch(() => null);
  if (r) return refusalResponse(r);
  return typeof fallback === 'function' ? fallback() : fallback;
}
