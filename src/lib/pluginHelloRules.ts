// What the plugin's login greeting (/api/plugin/hello) tells a client that has NOT signed in.
//
// The greeting needs no token, so anything it says about a name is said to anyone with curl. It used
// to answer "is this RSN a member, a guest or neither in this clan?" for any name sent — a roster
// probe — and listed a members-only clan's running events to the world.
//
// PURE — tests/plugin-hello-rules.test.ts.

import { clanVisibilityOf } from '@/lib/clanVisibility';

/** Does the reply list what is running? To a signed-in client, or for a clan that is public anyway. */
export function helloListsActivity(signedIn: boolean, clanVisibility: string | null | undefined): boolean {
  return signedIn || clanVisibilityOf(clanVisibility) === 'public';
}
