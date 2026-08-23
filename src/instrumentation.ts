// Next.js boot hook — runs once per server process, before the first request.
//
// Used for reconciles that must survive a deploy without anyone remembering to run them. Everything
// here is best-effort and non-blocking by contract: a failure must never stop the app from booting,
// because a clan site that won't start is worse than any of the things being reconciled.

export async function register() {
  // Edge and the build's data-collection pass both import this file; neither should reconcile.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // Slash commands: whatever this build defines becomes what Discord has registered. Without it a
  // command added in code never appears and one removed lingers in members' autocomplete — both
  // silently. No-ops on the shared Anvil bot (the control plane owns that application's commands)
  // and on an instance with no bot at all. See lib/discordCommandSync.
  try {
    const { syncClanCommandsInBackground } = await import('@/lib/discordCommandSync');
    syncClanCommandsInBackground('boot');
  } catch {
    /* a clan that can't reach Discord at boot still boots */
  }
}
