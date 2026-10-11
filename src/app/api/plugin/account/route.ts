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
import { accountForCharacter, accountStanding, playedCharacter } from '@/lib/pluginAccount';
import { fileCharacterReport } from '@/lib/characterReports';
import { resolveClanFromRequest } from '@/lib/clanContext';

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
//   POST { action: 'dispute' } "It's mine": the character is claimed by somebody else; raise it with
//                              Anvil staff as a wrong-owner report, with this login as claimant.
//
// None of these run resolvePluginMember — a request whose point is "not mine" must never be the one
// that links it.

async function authed(request: Request) {
  const auth = await pluginTokenPerson(request);
  if (!auth) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) } as const;
  const character = playedCharacter(request);
  if (!character) {
    return { error: NextResponse.json({ error: 'Log in to the account first (no X-RSN).' }, { status: 400 }) } as const;
  }
  return { userId: auth.userId, character } as const;
}

export async function GET(request: Request) {
  const a = await authed(request);
  if ('error' in a) return a.error;
  return NextResponse.json({ standing: await accountStanding(a.userId, a.character) });
}

export async function POST(request: Request) {
  const a = await authed(request);
  if ('error' in a) return a.error;
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

  if (action === 'dispute') {
    if (!account || account.claimedAt == null || ours || me == null) {
      return NextResponse.json({ error: 'This account isn’t linked to anyone else.' }, { status: 409 });
    }
    // The hash is the strongest thing the plugin can say: the character really is logged in here.
    // Recorded as a yes/no — the hash itself is a credential and never goes into a report.
    const hashMatched = !!character.accountHash && account.accountHash === character.accountHash;
    const clan = await resolveClanFromRequest(request).catch(() => null);
    const { created } = await fileCharacterReport({
      accountId: account.id,
      clanId: clan?.id ?? null,
      reportedByUserId: userId,
      claimantPlayerId: me,
      kind: 'wrong_owner',
      body:
        `Raised from the RuneLite plugin: this login says ${character.rsn} is theirs, but it is linked to someone else. ` +
        (hashMatched
          ? 'The plugin was logged into the character (account hash matched).'
          : 'No account-hash match — the name alone was reported.'),
    });
    return NextResponse.json({ ok: true, filed: true, alreadyOpen: !created });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
