// Who talks to the hiscores: this app, or Anvil.Forge.
//
// Exactly one of them may. Both polling means double the requests from one IP, and that budget is
// the one thing here that cannot be bought back — exceed what Jagex tolerates and the box is
// blocked, which stops tracking for EVERY clan at once.
//
// Either way this app runs the sweep (lib/statsSweep): it decides who is due and applies every
// result. The owner only decides who FETCHES:
//
//   site  — /api/cron/stats fetches in-process.
//   forge — /api/cron/forge-consume queues requests in hiscores_fetches and applies what Forge
//           fetched. Forge fetches nothing it was not asked for.
//
// So "both fetching" can only happen through a queue left over from a Forge period, and the Site
// path purges that queue before it fetches (lib/forgeFetchQueue purgePendingForgeFetches). A dead
// Forge is caught by the drain itself: a request waiting too long logs `forge-drain.stalled`.

export type SweepOwner = 'site' | 'forge';

/** Who the operator says owns the fetching. `STATS_SWEEP_OWNER=forge` hands it to Forge. */
export function declaredSweepOwner(env: Record<string, string | undefined> = process.env): SweepOwner {
  return (env.STATS_SWEEP_OWNER || '').trim().toLowerCase() === 'forge' ? 'forge' : 'site';
}
