import pkg from '../../package.json';

/**
 * Deployment identity + plugin-API contract, in one place.
 *
 * Self-hosted instances can lag many releases behind the always-latest hub plugin, and one plugin
 * multi-homes across several sites on different versions at once — so the plugin gates features on
 * the CAPABILITIES a site advertises, never on version-number comparison. The full contract and
 * change rules live in docs/PLUGIN_WIRE.md; the short form:
 *
 *  - Plugin-facing responses are additive-only: new fields/endpoints may appear, existing ones
 *    never change meaning or disappear within an api level.
 *  - Shipping a new plugin-facing feature family? Add its capability string here so newer plugins
 *    can detect it on older sites that lack it.
 *  - A breaking change (remove/rename/repurpose) requires bumping PLUGIN_API_LEVEL and a
 *    release-note callout — old plugins compare it to decide "this site is too new/old for me".
 */
export const APP_VERSION: string = pkg.version;

/** Immutable git SHA baked in by CI (Dockerfile ARG). 'dev' outside a CI-built image. */
export const GIT_SHA: string = process.env.GIT_SHA || 'dev';

export const PLUGIN_API_LEVEL = 1;

// Baseline set as of v1.0.0 — everything the plugin-facing API supported when the handshake first
// shipped. Sites that predate the handshake send nothing; the plugin treats "no server block" as
// exactly this baseline.
export const PLUGIN_CAPABILITIES = [
  'stats-live', // live stat overlay pushes + unified KC/XP tracking
  'drop-tiles',
  'kill-tiles',
  'timed-tiles',
  'lms-tiles',
  'value-tiles',
  'gain-tiles',
  'deathless-tiles',
  'pvp-tiles',
  'diary-tiles',
  'ca-tiles',
  'clog-tiles',
  'weekly', // SOTW/BOTW competitions
  'schedule',
  'notify', // server-forwarded Discord notifications
  'counters',
  'activity-feed',
  'federation',
  'ladder', // ladder format + missions board + standings
  'reveal-modes', // showdown / lucky-draw / bounty / rotating reveal policies
  'config-etag', // conditional GET on /api/plugin/config + /board
  'bingo-missions', // mid-event announced mission tiles on a normal bingo (lockout/bonus/decay/expiry)
  // Live push for the hiscores counters that are neither a boss nor a skill. The wire accepts any
  // key in HISCORES_ACTIVITIES; which of them a client can actually read is the plugin's business.
  'activity-stats',
  // Server-relayed OBS clips: POST /api/plugin/clip uploads the video and the server posts it to the
  // clan's clips channel, so members don't each paste a webhook into their plugin config.
  'clip-relay',
  // Collection log, personal bests and (later) quests/diaries/CAs pushed from the plugin to a
  // member's profile. Advertised only once the endpoints and tables exist, because the plugin gates
  // ALL of its reading on this: an older site is never polled, and a newer plugin against it does
  // no widget reads, queues nothing and sends nothing.
  'profile-sync',
  // Seasonal routing: /api/plugin/notify accepts `seasonal: true` and posts to the clan's Leagues
  // channel (falling back to the normal one), marking the embed as seasonal.
  'leagues-channel',
  // Starting shot (lib/startProof): /api/plugin/config carries a `startProof` block and
  // POST /api/events/:id/start-proof accepts the capture, so the plugin can show its button.
  'start-proof',
  // Account progress: POST /api/plugin/progress stores quest points, combat-achievement points and
  // tier, and diary counts per member (lib/memberProgress). Gated so a plugin doesn't push into a
  // 404 on a site that predates the table.
  'progress',
  // Highlight feed: POST /api/plugin/moments takes pets/drops/deaths as the client saw them and the
  // server decides which competition week or board they belong to (lib/moments). Gated because a
  // plugin that pushed these at a site without the endpoint would just collect 404s.
  'moments',
] as const;

/** The `server` block returned to the plugin (and /api/version). */
export function serverInfo() {
  return {
    version: APP_VERSION,
    sha: GIT_SHA,
    apiLevel: PLUGIN_API_LEVEL,
    capabilities: [...PLUGIN_CAPABILITIES],
  };
}
