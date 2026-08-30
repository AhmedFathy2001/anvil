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

// Deliberately still 1 after federation was removed. The contract calls a capability removal a
// breaking change, but the plugin treats an out-of-range apiLevel as "this clan's site needs an
// update" — bumping would fire that warning on every client in the wild over a surface they can
// already detect. Dropping the capability string IS the negotiated degradation: plugins gate the
// Connect-clans UI on supports("federation"), so they hide it on their own with no update.
export const PLUGIN_API_LEVEL = 1;

// Baseline set as of v1.0.0 — everything the plugin-facing API supported when the handshake first
// shipped. Sites that predate the handshake send nothing; the plugin treats "no server block" as
// exactly this baseline.
export const PLUGIN_CAPABILITIES = [
  // This site resolves the clan from the TOKEN when the address names none, so the bare apex works
  // and a per-clan subdomain is no longer required. Plugins gate the "you can simplify your URL"
  // nudge on this, so they stay quiet against a site that still needs the old address.
  'apex-routing',
  // /api/plugin/config names the clan it answered for (`activeClan`) and lists every clan this
  // person holds a seat in (`clans[]`), so the plugin can show a switcher and then ADDRESS a clan
  // with a `/c/<slug>` prefix instead of leaving the server to re-guess on every request. Gated
  // because a plugin that offered the dropdown against a site without the fields would render it
  // empty and strand anybody who is in two clans.
  'clan-switch',
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
/**
 * The address this deployment would rather be reached at.
 *
 * One site now serves every clan, so a per-clan subdomain is a legacy address that resolves the
 * clan from the Host instead of from the caller's token. Both still work, but the apex is the one
 * that keeps working when someone joins a second clan — so the plugin can compare what a user
 * typed against this and offer to move them.
 *
 * SERVER-ADVERTISED RATHER THAN BAKED INTO THE PLUGIN, because Anvil is self-hostable: a hard-coded
 * anvilosrs.com would tell every self-hoster to point their plugin at somebody else's server. Each
 * deployment names its own, and a plugin that receives nothing simply says nothing.
 */
export function canonicalUrl(): string | null {
  // The APEX is the canonical address, by definition: a clan lives at `<slug>.<apex>`, and the apex
  // itself is the clanless surface that serves every clan. Deriving it from ANVIL_APEX_DOMAIN
  // rather than a second setting means a deployment cannot advertise an address that disagrees
  // with the one it actually answers on — and preview/staging get their own for free.
  //
  // APP_URL still wins when set, for a deployment whose public address is not simply its apex
  // (a custom domain in front, say).
  // Read straight from the environment rather than importing clanContext's apexDomain(): this
  // module is pure metadata, called on every /config response, and clanContext pulls in the whole
  // database module graph. One duplicated env read is a much smaller price than that coupling.
  const raw = (process.env.APP_URL || '').trim()
    || (process.env.ANVIL_APEX_DOMAIN || '').trim().toLowerCase();
  if (!raw) return null;
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

export function serverInfo() {
  return {
    version: APP_VERSION,
    sha: GIT_SHA,
    apiLevel: PLUGIN_API_LEVEL,
    capabilities: [...PLUGIN_CAPABILITIES],
    // Where this deployment prefers to be called. Additive: older plugins ignore it.
    canonicalUrl: canonicalUrl(),
  };
}
