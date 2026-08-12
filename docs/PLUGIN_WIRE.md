# Plugin ↔ Site wire contract

How the Anvil RuneLite plugin and an Anvil site stay compatible while shipping on
completely different schedules.

## The problem this solves

- The **plugin** installs from the RuneLite Plugin Hub, so effectively every player runs
  the **latest** plugin.
- A **site** is one deployment per clan. Hosted clans track our release channels, but
  **self-hosted instances can lag by months**.
- The plugin **multi-homes**: through federation one plugin instance talks to several
  sites at once, each potentially on a different version.

So "check the version number" doesn't work as a compat strategy — the plugin instead asks
each site **what it can do** and gates features per-site.

## The handshake

Every response from `GET /api/plugin/config` (all shapes, enrolled or not) carries:

```json
"server": {
  "version": "1.4.2",          // the site's semver (package.json)
  "sha": "ab12cd…",            // exact commit the image was built from
  "apiLevel": 1,               // breaking-change counter, see below
  "capabilities": ["ladder", "clog-tiles", …]
}
```

The same object is public at `GET /api/version` (plus `"name": "anvil"`) for humans and
tooling.

The plugin sends `X-Anvil-Plugin-Version: <its version>` on every request, so a site can
log which plugin versions its members run and reason about dropping legacy tolerances.

### Legacy sites

Sites older than v1.0.0 send no `server` block. The plugin must treat a missing block as
exactly the **v1.0.0 baseline capability set** (the list in `src/lib/serverInfo.ts` as of
v1.0.0) — never as "supports nothing", which would break every not-yet-updated site.

## Rules of change

1. **Plugin-facing API changes are additive-only.** New fields and endpoints may appear at
   any time; existing fields never change meaning, type, or disappear within an api level.
   Both sides already tolerate the other's unknowns: GSON drops unknown JSON fields in the
   plugin; the site treats absent request fields as optional.
2. **New feature family ⇒ new capability string.** When the site grows a new plugin-facing
   surface, add a string to `PLUGIN_CAPABILITIES` in `src/lib/serverInfo.ts`, and gate the
   plugin's use of it on that string (`supports("thing")`). On sites that predate the
   feature the plugin then hides the surface instead of 404ing.
3. **Breaking changes bump `apiLevel`** (and get a loud release-note callout). The plugin
   carries a `MIN_SUPPORTED_API_LEVEL`/known-max; a site outside that range gets a clear
   "this clan's site needs an update" notice instead of mysterious failures. Treat an
   apiLevel bump as a last resort — in practice almost everything can be additive.
4. **Deprecation window.** The plugin keeps working against sites up to **two minor
   versions / ~6 months** old. Dropping tolerance for older sites is a plugin release-note
   item, not a silent change.

## Capability registry

Defined in `src/lib/serverInfo.ts` (site) — that list is the source of truth. Baseline as
of v1.0.0: `stats-live`, `drop-tiles`, `kill-tiles`, `timed-tiles`, `lms-tiles`,
`value-tiles`, `gain-tiles`, `deathless-tiles`, `pvp-tiles`, `diary-tiles`, `ca-tiles`,
`clog-tiles`, `weekly`, `schedule`, `notify`, `counters`, `activity-feed`, `federation`,
`ladder`, `reveal-modes`, `config-etag`. Post-baseline additions: `bingo-missions`
(mid-event announced mission tiles on a normal bingo — the plugin gates its mission strip
on this so it isn't confused by a self-hosted site that predates the feature);
`activity-stats` (`POST /api/plugin/stats` accepts an `activities: [{key, value}]` array
alongside `stats` / `skills`, for the hiscores counters that aren't a boss or a skill).

### `activity-stats`

Boss KC and skill XP are pushed by in-game NAME and mapped server-side. Activities are
pushed by the site's own KEY — the plugin reads each from a named varbit, so it knows
which counter it holds and there is nothing to map. Keys are the `key` field of
`HISCORES_ACTIVITIES` in `src/lib/hiscoresActivities.ts`; unknown keys are dropped.

Only the counters the client can actually read are pushable — currently the six clue tiers
(plus `cluesAll` as their sum), `colosseumGlory` and `collectionsLogged`. Rank-based
entries (LMS, PvP Arena, Bounty Hunter) have no in-game equivalent, GOTR has per-game
varbits but no absolute rifts-closed total, and Soul Wars' varp is a spendable zeal
BALANCE where the hiscores counter is zeal EARNED. Tiles tracking those stay on the
15-minute hiscores sweep — the pre-`activity-stats` behaviour, not a regression.

The site sends every activity key the board tracks and lets the plugin filter down to what
it can read, so growing the readable set is a plugin release rather than a wire change.
Values are absolute and the server keeps `max(hiscores, pushed)`, so a counter the client
hasn't synced yet can never walk a tile backwards.

## Checklist: shipping a new plugin-facing feature

On the site:
- [ ] New response fields / endpoints only — nothing existing removed or repurposed.
- [ ] Add the capability string to `PLUGIN_CAPABILITIES`.

On the plugin:
- [ ] Parse the new fields null-safely (old sites won't send them).
- [ ] Gate the new surface on `supports("<capability>")`; missing block ⇒ baseline set.
- [ ] Degrade to hiding the feature (optionally with a "site is older" hint), never to an
      error state.
