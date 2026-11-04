import { NextResponse } from 'next/server';
import { pluginTokenPerson } from '@/lib/auth';
import { personOf } from '@/lib/roster';
import { rateLimitByKey } from '@/lib/rate-limit';
import {
  LIVE_EVENT_RELEASE_MESSAGE,
  markCharacterIgnored,
  releaseCharacter,
  unmarkCharacterIgnored,
} from '@/lib/accountRelease';
import { accountForCharacter, accountStanding, playedCharacter, type PlayedCharacter } from '@/lib/pluginAccount';
import { fileCharacterReport } from '@/lib/characterReports';
import { resolveClanFromRequest } from '@/lib/clanContext';
import { startOwnershipClaim } from '@/lib/ownershipClaims';

// /api/plugin/account — the sidebar's account row: "is this character mine?", from the plugin.
//
// The Account Token names whoever set this RuneLite up, not whoever is playing. Siblings on one PC
// and friends visiting each other are the cases it gets wrong, so the plugin links what it plays by
// default (the easy path) and offers a one-click way out on the character itself:
//
//   GET                       → { standing } for the logged-in character (lib/pluginAccount)
//   POST { action: 'release' } "Not my account": unlink it from this login (the profile's Remove,
//                              lib/accountRelease) and stop auto-linking it. The plugin stops
//                              sending anything while it's logged in.
//   POST { action: 'resume' }  Undo that: the next request links it again as before.
//   POST { action: 'dispute' } "It's mine" / "This is my account": the character is claimed by
//                              somebody else. Opens an ownership claim (lib/ownershipClaims) the owner
//                              answers — or, when the plugin can't show the character is logged in
//                              here, a wrong-owner report for Anvil staff. ('claim' is an alias.)
//
// None of these run resolvePluginMember — a request whose point is "not mine" must never be the one
// that links it.

type Authed = { ok: true; userId: number; character: PlayedCharacter } | { ok: false; response: NextResponse };

async function authed(request: Request): Promise<Authed> {
  const auth = await pluginTokenPerson(request);
  if (!auth) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const character = playedCharacter(request);
  if (!character) {
    return { ok: false, response: NextResponse.json({ error: 'Log in to the account first (no X-RSN).' }, { status: 400 }) };
  }
  return { ok: true, userId: auth.userId, character };
}

export async function GET(request: Request) {
  const a = await authed(request);
  if (!a.ok) return a.response;
  return NextResponse.json({ standing: await accountStanding(a.userId, a.character) });
}

export async function POST(request: Request) {
  const a = await authed(request);
  if (!a.ok) return a.response;
  const { userId, character } = a;

  const rl = await rateLimitByKey('plugin-account', String(userId), { limit: 20, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests — try again in a few minutes.' }, { status: 429 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const nowIso = new Date().toISOString();

  if (action === 'resume') {
    await unmarkCharacterIgnored(userId, character.rsnNormalized);
    return NextResponse.json({ ok: true, standing: await accountStanding(userId, character) });
  }

  const account = await accountForCharacter(character);
  const me = await personOf(userId);
  const ours = account?.claimedAt != null && me != null && account.playerId === me;

  if (action === 'release') {
    if (account && ours) {
      const outcome = await releaseCharacter({ userId, playerId: me!, accountId: account.id, nowIso, via: 'plugin' });
      if (!outcome.ok && outcome.reason === 'live-event') {
        // Still remember the choice, so nothing re-links it once the event is over — but say plainly
        // that the site keeps it until then; the plugin stops sending either way.
        await markCharacterIgnored(userId, character.rsn, character.rsnNormalized, character.accountHash, nowIso);
        return NextResponse.json({ error: LIVE_EVENT_RELEASE_MESSAGE, reason: 'live-event' }, { status: 409 });
      }
    } else {
      // Not linked to this login (somebody else's, or nobody's): nothing to detach, but remember it
      // so this login's plugin never links it later — from this PC or any other.
      await markCharacterIgnored(userId, character.rsn, character.rsnNormalized, character.accountHash, nowIso);
    }
    return NextResponse.json({ ok: true, standing: await accountStanding(userId, character) });
  }

  if (action === 'dispute' || action === 'claim') {
    // "This is my account" (the plugin's "It's mine"): an ownership claim (lib/ownershipClaims). It
    // starts with the XP check — nothing this request carries (its account hash included) is proof —
    // and only once that's passed is the owner told, or Anvil staff. The claimant learns nothing
    // about who the owner is. Looked up by NAME there; the hash plays no part.
    const claim = await startOwnershipClaim({ userId, character, nowIso });
    if (claim.ok) {
      return NextResponse.json({ ok: true, filed: true, claim: true, alreadyOpen: !claim.created, status: claim.status, message: claim.message });
    }
    if (claim.reason === 'not-other') return NextResponse.json({ error: claim.error }, { status: 409 });
    if (claim.reason === 'taken') return NextResponse.json({ error: claim.error, reason: claim.reason }, { status: 409 });
    if (claim.reason === 'rate-limited') return NextResponse.json({ error: claim.error, reason: claim.reason }, { status: 429 });
    if (claim.reason === 'cooldown') {
      return NextResponse.json({ ok: true, filed: true, claim: false, alreadyOpen: true, message: claim.error });
    }
    // The XP check can't run (an unranked character, the hiscores down): Anvil staff look, as a
    // wrong-owner report with this login as claimant — unproved, and it says so.
    const named = await accountForCharacter({ ...character, accountHash: null });
    const claimant = await personOf(userId);
    if (!named || claimant == null) return NextResponse.json({ error: claim.error }, { status: 502 });
    const clan = await resolveClanFromRequest(request).catch(() => null);
    const { created } = await fileCharacterReport({
      accountId: named.id,
      clanId: clan?.id ?? null,
      reportedByUserId: userId,
      claimantPlayerId: claimant,
      kind: 'wrong_owner',
      body:
        `Raised from the RuneLite plugin: this login says ${named.rsn} is theirs, but it is linked to someone else. ` +
        'Not proved: the XP check could not run (hiscores unavailable or unranked).',
    });
    return NextResponse.json({
      ok: true,
      filed: true,
      claim: false,
      alreadyOpen: !created,
      message: 'Sent to Anvil staff. They’ll check and move it to you if it’s yours.',
    });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
