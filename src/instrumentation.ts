// Next.js boot hook — runs once per server process, before the first request.
//
// Used for reconciles that must survive a deploy without anyone remembering to run them. A failure
// must never stop the app from booting, but the work itself is awaited: an unawaited promise can be
// killed with the old container while the deploy health check has already declared success.

export async function register() {
  // Edge and the build's data-collection pass both import this file; neither should reconcile.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // Slash commands: whatever this build defines becomes what Discord has registered. Without it a
  // command added in code never appears and one removed lingers in members' autocomplete — both
  // silently. Registers `sharedBotToken()`'s commands globally for the deployment; clan-owned bot
  // tokens are registered to their own guild when saved. No-ops on an instance with no bot. The daily
  // /api/cron/discord-commands re-runs the same reconcile and is the deploy's hard success gate.
  // DISCORD_COMMAND_SYNC=off disables this on a staging deployment that shares production's bot.
  // See lib/discordCommandSync.
  try {
    const { syncClanCommands } = await import('@/lib/discordCommandSync');
    await syncClanCommands();
  } catch {
    /* a clan that can't reach Discord at boot still boots */
  }
}

/**
 * Every server-side failure, in one place.
 *
 * Next calls this for anything that throws while serving: a React Server Component render, a route
 * handler, a server action, the proxy. Before this the app's response to all of that was a line on
 * stdout inside a container nobody reads — which is how a board that 500s at two in the morning gets
 * discovered by a member posting in Discord.
 *
 * ONLY THE NODE RUNTIME. The edge runtime has no database, and the proxy's own failures are better
 * read from the platform log than written from a context that cannot reach Postgres.
 *
 * Nothing here is awaited by the request and nothing here may throw: see lib/errorEvents for why
 * that is the whole design rather than caution.
 */
/**
 * The message, plus the reason underneath it.
 *
 * THE CAUSE WAS BEING THROWN AWAY, and for the failures that matter most it was the whole message.
 * A drizzle error reads "Failed query: insert into … values ($1, $2, $3), ($4, $5, $6), …" for a
 * thousand characters and says nothing whatsoever about what went wrong; the Postgres error — the
 * foreign key, the constraint, the type — hangs off `err.cause` and never reached the row. The first
 * ops digest this platform sent had a wall of `$1, $2, $3` at the top of it and no way to tell what
 * had failed a hundred and fifty times an hour without opening a psql prompt.
 *
 * The query still leads, because it is what identifies the failure, but it is cut short: a cause
 * appended after a thousand characters of SQL is a cause nobody will ever see, since the message
 * column is truncated before that.
 *
 * Safe for fingerprinting — `normalizeMessage` already scrubs numbers, quoted values, uuids and
 * hashes, so "Key (account_id)=(123) is not present" collapses the same way for every occurrence
 * rather than minting a new error per row.
 */
function messageWithCause(err: Error): string {
  const head = err.message.length > 300 ? `${err.message.slice(0, 300)}…` : err.message;
  const causes: string[] = [];
  let cause: unknown = (err as { cause?: unknown }).cause;
  // Bounded: a cause chain is normally one deep, and an accidental cycle must not hang the reporter
  // that is already running inside a failure.
  for (let depth = 0; depth < 3 && cause instanceof Error; depth++) {
    causes.push(`${cause.name}: ${cause.message}`);
    cause = (cause as { cause?: unknown }).cause;
  }
  return causes.length === 0 ? err.message : `${head} — caused by ${causes.join(' — caused by ')}`;
}

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: NodeJS.Dict<string | string[]> },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { captureError } = await import('@/lib/errorEvents');
    const { clanIdForError } = await import('@/lib/errorClan');

    const err = error instanceof Error ? error : new Error(String(error));
    captureError({
      name: err.name,
      message: messageWithCause(err),
      stack: err.stack,
      path: request.path,
      method: request.method,
      // "render/app" reads better in a digest than the object Next hands over, and the render source
      // distinguishes an RSC failure from an SSR one, which fail for different reasons.
      source: [context.routeType, context.renderSource].filter(Boolean).join('/') || null,
      // Resolved from the request's own headers rather than from ambient state: by the time this
      // runs the request context is gone, and a wrong clan is worse than none.
      clanId: await clanIdForError(request.headers, request.path),
    });
  } catch {
    /* the error reporter failing must never be a second error */
  }
}
