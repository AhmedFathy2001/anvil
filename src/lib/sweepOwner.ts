// Who is allowed to fetch the hiscores: this app, or Anvil.Forge.
//
// Exactly one of them may. Both sweeping means both polling Jagex, and that budget is the one thing
// here that cannot be bought back — exceed what they tolerate and the box's IP is blocked, which
// takes tracking down for EVERY clan at once, not just the one that caused it.
//
// The two failure directions are not symmetric, and that asymmetry is the whole design:
//
//   BOTH OFF — nothing updates. Obvious within a tick, and someone reports it.
//   BOTH ON  — everything looks perfectly normal, right up until Jagex stops answering.
//
// So the quiet-and-expensive direction gets two independent guards. The declared owner is the
// intentional one, and the observed-activity check is the backstop for the case the declaration is
// simply wrong — a forgotten env var on one of two services being the ordinary way this happens.


export type SweepOwner = 'site' | 'forge';

/**
 * How recently Forge must have run for its claim on the sweep to be believed.
 *
 * Comfortably longer than its tick (seconds) and than any single sweep (bounded to ~4 minutes), so
 * an ordinary gap never looks like Forge is gone. Short enough that a genuinely dead Forge hands the
 * sweep back within the hour rather than leaving tracking silently stopped.
 */
const FORGE_LIVENESS_WINDOW_MS = 30 * 60_000;

/** Who the operator SAYS owns the sweep. `STATS_SWEEP_OWNER=forge` stands this app's sweep down. */
export function declaredSweepOwner(): SweepOwner {
  return (process.env.STATS_SWEEP_OWNER || '').trim().toLowerCase() === 'forge' ? 'forge' : 'site';
}

/**
 * When Forge last recorded a sweep tick, or null if it never has.
 *
 * `forge_sweep_runs` belongs to Forge's migration chain, not this app's, so on a deployment where
 * Forge has never run the table simply does not exist. That is not an error condition — it is the
 * answer — hence the catch: any failure to read means "no evidence of Forge", which resolves to this
 * app keeping the sweep. Failing the other way would stop tracking on every site that has never
 * heard of Forge.
 */
export async function forgeLastSweptAt(): Promise<Date | null> {
  try {
    // Imported here rather than at module scope so the policy above stays a pure function that can
    // be reasoned about — and tested — without standing up a database for it.
    const { pool } = await import('@/db');
    const { rows } = await pool.query<{ last: Date | null }>(
      'SELECT max(started_at) AS last FROM forge_sweep_runs WHERE NOT shadow',
    );
    return rows[0]?.last ?? null;
  } catch {
    return null;
  }
}

export interface SweepDecision {
  /** Whether THIS app should fetch hiscores on this tick. */
  run: boolean;
  /** Machine-readable reason, for the tick log. */
  reason: 'site-owns' | 'declared-forge' | 'forge-active' | 'forge-stale';
  /** One line for a human reading the log. */
  detail: string;
}

/**
 * Decide whether this app's sweep should fetch on this tick.
 *
 * Pure given its inputs so the policy is testable without a database; `shouldSiteSweep` supplies the
 * real ones.
 */
export function decideSweep(
  declared: SweepOwner,
  forgeLastSwept: Date | null,
  now: Date = new Date(),
): SweepDecision {
  const forgeAgeMs = forgeLastSwept ? now.getTime() - forgeLastSwept.getTime() : Infinity;
  const forgeActive = forgeAgeMs <= FORGE_LIVENESS_WINDOW_MS;

  // The backstop, and the reason this function exists. Forge is demonstrably fetching right now, so
  // this app must not — whatever the configuration claims. A wrong declaration is the ordinary way
  // two services end up both sweeping, and it is the failure nobody notices.
  if (forgeActive && declared === 'site') {
    return {
      run: false,
      reason: 'forge-active',
      detail:
        'Forge swept ' +
        Math.round(forgeAgeMs / 1000) +
        's ago but STATS_SWEEP_OWNER is not set to "forge" — standing down to avoid double-polling ' +
        'Jagex. Set STATS_SWEEP_OWNER=forge to make this intentional, or stop the Forge sweep.',
    };
  }

  if (declared === 'forge') {
    // Declared handover, and Forge is keeping up. The expected steady state.
    if (forgeActive) {
      return { run: false, reason: 'declared-forge', detail: 'Forge owns the sweep and is active.' };
    }

    // Declared handover, but no sign of Forge. Deliberately does NOT take the sweep back: a silent
    // failover would mean two sweeps the moment Forge recovers, which is the exact outcome this
    // module exists to prevent. Better to stop and be loud than to resume and be quiet.
    return {
      run: false,
      reason: 'forge-stale',
      detail: forgeLastSwept
        ? `Forge owns the sweep but has not run for ${Math.round(forgeAgeMs / 60_000)} minutes — ` +
          'NOTHING IS BEING TRACKED. Restart Forge, or set STATS_SWEEP_OWNER=site to take it back.'
        : 'Forge owns the sweep but has never recorded a run — NOTHING IS BEING TRACKED. Start ' +
          'Forge, or set STATS_SWEEP_OWNER=site to take it back.',
    };
  }

  return { run: true, reason: 'site-owns', detail: 'This app owns the sweep.' };
}

/** The decision for this tick, reading the declared owner and Forge's recent activity. */
export async function shouldSiteSweep(now: Date = new Date()): Promise<SweepDecision> {
  const decision = decideSweep(declaredSweepOwner(), await forgeLastSweptAt(), now);

  if (!decision.run) {
    // Warn, not info: every non-running state here is either a handover worth seeing in the log or a
    // misconfiguration that has stopped tracking outright.
    const { log } = await import('@/lib/logger');
    log.warn('stats-cron.stood-down', { reason: decision.reason, detail: decision.detail });
  }
  return decision;
}
