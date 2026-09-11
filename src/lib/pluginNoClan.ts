// "This account is in no clan" is an ANSWER, not a crash.
//
// Every plugin route that needs a clan reached for `requirePluginClan`, which throws when nothing
// names one. That was right while a plugin token implied a clan: you got the token from your clan's
// site, so no-clan meant a broken request. It stopped being right when an Anvil account became a
// PERSON's — the site keeps their collection log, records and personal bests with no clan anywhere,
// the plugin's own first-run nudge says so, and signing in without a clan is now the ordinary way to
// start.
//
// So a perfectly normal person's client asked a question with no answer every thirty seconds, and
// every one of those was a 500 with a stack trace in `error_events`. Nothing was broken and nothing
// reported it as anything else: the first ops digest this platform ever sent was a third full of
// people using the product exactly as advertised.
//
// 404 RATHER THAN AN EMPTY 200. An older jar handed a config object full of nulls renders a clan
// card with no name in it, which is worse than the panel's own empty state — and the panel already
// has one written for precisely this. A non-2xx leaves the plugin holding no config, which is what
// it already does with the 500 and what the sidebar's signed-in-with-no-clan state is drawn for.

import { NextResponse } from 'next/server';

export function noClanForPlugin(): NextResponse {
  return NextResponse.json({ error: 'No clan for this account yet' }, { status: 404 });
}
