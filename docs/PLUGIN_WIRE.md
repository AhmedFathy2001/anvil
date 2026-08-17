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
alongside `stats` / `skills`, for the hiscores counters that aren't a boss or a skill);
`clip-relay` (`POST /api/plugin/clip` uploads a saved OBS clip and the server posts it to
the clan's clips channel); `leagues-channel` (`POST /api/plugin/notify` accepts
`seasonal: true`); `profile-sync` (a member's collection log + personal bests, pushed to
`POST /api/plugin/clog` and `/api/plugin/pb`); `start-proof` (the anti-stack starting shot
— a `startProof` block on `/api/plugin/config` and `POST /api/events/:id/start-proof`);
`moments` (`POST /api/plugin/moments` — the pets/uniques/deaths highlight feed for a
competition week or a running board).

### `leagues-channel`

A league is a separate game mode on separate worlds: the drops are absurd by main-game
standards and the kill counts mean nothing beside them, so mixing both in one channel makes
both unreadable.

The plugin sends `seasonal: true` alongside the normal `channel` when the logged-in world
carries `WorldType.SEASONAL`. It reports only WHERE the player is — the server decides what
that means, so a clan can change the destination without a plugin release:

- Routes to `webhook_leagues` when set, else **falls back to the channel the plugin named**.
  Routing is an improvement, not a precondition; a post is never dropped for an unset webhook.
- Marks the embed server-side — `[Seasonal]` on the title, the league's icon as the thumbnail
  when the embed hasn't set one. Applied after the embed is composed, so every notification
  kind is marked without the plugin knowing about each, and clients already in the wild get
  it on deploy.

The icon is the `leagues_icon_url` setting when set; otherwise the current league's logo is
resolved from the wiki once a day, falling back to the generic Leagues icon.

### `clip-relay`

Clips are the one thing the plugin historically posted to Discord itself, uploading to a
webhook URL each user pasted into their own plugin config — a video is megabytes, and the
plugin may never call a URL a server response handed it. With this capability the plugin
instead uploads to the site it is already authenticated against (its own configured Site
URL, which is not a URL we handed it) and the server resolves `webhook_clips` and posts.

`POST /api/plugin/clip`, `multipart/form-data`, plugin-token auth:

- `file` — the video. Max **10MB** (Discord's non-boosted webhook ceiling); `413` above it.
  Types: `video/mp4`, `video/x-matroska`, `video/quicktime`, `video/webm` (`415` otherwise).
- `payload_json` — optional `{ moment, eventName, seconds }`. `moment` is the plugin's own
  one-line summary of what the clip caught; the server composes the embed around it.

Distinct failures the plugin is expected to surface rather than swallow: `501` (the clan
has no clips channel configured), `413` (too big to post anywhere), `502` (Discord refused).
Rate limit is 6/min per token holder.

A plugin keeps both fallbacks: the user-pasted webhook when a site lacks this capability,
and local-only when there is neither.

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

### `profile-sync`

A member's collection log and personal bests, pushed by the plugin — the hiscores carry a clog slot
COUNT and no best times at all, so the client is the only possible source.

`POST /api/plugin/pb` takes best times. `POST /api/plugin/clog` takes the log, in either of two
shapes, because the game offers two very different ways to read it:

- **`{ pages: [{ name, obtained, total, items: [{id, q}], counts }] }`** — what the player has drawn.
  The client holds ONE page at a time, so this arrives in pieces as they browse. Each page replaces
  independently; a page whose item count disagrees with our catalogue is skipped rather than
  committed, so a game update can't delete someone's page. This is the only route that carries the
  kill-count lines (`counts`).
- **`{ items: [{id, q}] }`** — the WHOLE log at once, with no page names. Opening the collection log
  and toggling its Search makes the server transmit every entry (one `COLLECTION_DELAYED_TRANSMIT`
  script fire per item — the technique is WikiSync's). The site maps ids onto pages from its own
  catalogue, so the plugin never ships one. Authoritative by construction, so it REPLACES the stored
  log; an empty `items[]` is refused rather than treated as "they own nothing", and `unknown` in the
  reply counts ids our catalogue lacks (i.e. `npm run data:clog` is due). Kill-count lines are left
  untouched — they can only come from a drawn page.

Both are idempotent, and `firstSeenAt` survives a re-sync: a resync is not a re-unlock.

### `start-proof`

The anti-stack "starting shot": on an event that requires one, every enrolled player files a
screenshot taken **after** the event went live, at a location drawn in the start transaction.

`/api/plugin/config` (enrolled shape) carries a `startProof` object, or `null` when the event
doesn't require one — which is also what a plugin sees on a site without this capability, so
the button simply never appears:

```json
{ "required": true, "drawn": true, "location": "Edgeville bank",
  "keyword": "ANVIL-GRAPE-47", "needsUpload": true, "status": null, "imageUrl": null }
```

`keyword` is per PLAYER and derived from the event's draw stamp — a value that does not exist
until the event starts — so it cannot be precomputed, by anyone. `location`/`keyword` are null
before the draw. Both are stable for the event's lifetime, so the block never churns the config
ETag.

Filing one: upload the PNG through `POST /api/upload` as usual, then
`POST /api/events/:eventId/start-proof` with plugin-token auth and
`{ imageUrl, keyword, capturedAt }`. The server recomputes the keyword; a plugin capture that
matches is accepted outright (the host can turn that off), anything else lands `pending` for
staff review. `409` means the event hasn't drawn yet or the player's shot is already accepted.

The gate is on submissions, not on the plugin: a credit from a player with no shot on file is
either flagged for review or refused with `409 { code: "start_proof_required" }`, per the
host's setting. A plugin that sees that code should KEEP the pending submission on disk and
retry after the player files their shot, rather than dropping the drop.

### `moments`

The highlight feed: pets, uniques, big hauls and deaths that happen while a competition week or a
bingo is running. `POST /api/plugin/moments`:

```json
{ "moments": [
  { "kind": "pet", "itemId": 20693, "itemName": "Rift guardian", "source": "Guardians of the Rift",
    "kc": 210, "at": "2026-08-17T10:00:00Z", "key": "pet-1755420000000" },
  { "kind": "drop", "itemId": 12922, "itemName": "Tanzanite fang", "quantity": 1,
    "valueGp": 3100000, "source": "Zulrah", "sourceKind": "npc", "kc": 1204, "at": "...", "key": "..." },
  { "kind": "death", "source": "Great Olm", "at": "...", "key": "death-1755420100000" }
] }
```

**The client reports what it saw; the server decides what it meant.** The plugin does not know which
competition is running, what counts as a unique, or which pets belong to which skill — it sends
everything plausible and the server (`src/lib/moments.ts`) keeps what belongs to an active scope:

- a **boss week** keeps uniques off that boss's own collection-log page, and deaths to it (including
  to a raid's rooms — nobody dies to "Chambers of Xeric", they die to Olm);
- a **skill week** keeps the pets that skill produces (`src/data/skillPets.json` — boss pets are
  absent by design, they match through their log page);
- a **bingo** keeps every pet and death, plus any haul the board recognises (a source or item one of
  its tiles names — including when nothing was credited) or that clears `moments_min_loot_gp`.

`key` is the client's idempotency key and is **required**: one pet fires three chat lines, one kill
fires two loot events, and a retry after a timeout arrives again on purpose. The server scopes the
key per board, so an observation may legitimately store on both a week and an event. `at` is
clamped — a client clock claiming next week, or more than a day ago, becomes "now".

Rarity is priced server-side from the shipped drop dataset and never read from the request.

**Never scoring.** Nothing here completes a tile, awards a point or moves a standing: no hiscores
read can confirm a drop. It is the colour around the numbers.

## Checklist: shipping a new plugin-facing feature

On the site:
- [ ] New response fields / endpoints only — nothing existing removed or repurposed.
- [ ] Add the capability string to `PLUGIN_CAPABILITIES`.

On the plugin:
- [ ] Parse the new fields null-safely (old sites won't send them).
- [ ] Gate the new surface on `supports("<capability>")`; missing block ⇒ baseline set.
- [ ] Degrade to hiding the feature (optionally with a "site is older" hint), never to an
      error state.
