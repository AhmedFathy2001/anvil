import { NextResponse } from 'next/server';

// Player-link login is retired, like captain password login before it (/api/captain/login). Everyone
// signs in with Discord and reaches their team through "My Team" (/team); the RuneLite plugin
// authenticates with its own linked token (pluginLinks), never a participant's player_token. This
// stub stays so an old bookmark gets a clear answer instead of an obscure 404.
//
// It also closes a credential: player_token was a bearer secret that minted a team session for anyone
// holding the link, and lib/auth verifyPlayer now refuses every session minted before the token-hash
// change, so nothing issues or honours one any more.
export async function POST() {
  return NextResponse.json(
    { error: 'Player links are no longer supported. Sign in with Discord and open My Team.' },
    { status: 410 },
  );
}
