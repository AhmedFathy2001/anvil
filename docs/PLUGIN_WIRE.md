# Plugin ↔ Site wire contract

How the Anvil RuneLite plugin and an Anvil site stay compatible while shipping on
completely different schedules.

## The problem this solves

- The **plugin** installs from the RuneLite Plugin Hub, so effectively every player runs
  the **latest** plugin.
- A **site** is one deployment per clan. Hosted clans track our release channels, but
  **self-hosted instances can lag by months**.
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
`clog-tiles`, `weekly`, `schedule`, `notify`, `counters`, `activity-feed`,
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
  "spot": { "x": 3094, "y": 3491, "radius": 25 }, "maxSessionMinutes": 15,
  "keyword": "ANVIL-GRAPE-47", "needsUpload": true, "status": null, "imageUrl": null }
```

`keyword` is per PLAYER and derived from the event's draw stamp — a value that does not exist
until the event starts — so it cannot be precomputed, by anyone. `location`/`keyword` are null
before the draw. Both are stable for the event's lifetime, so the block never churns the config
ETag.

`spot` is the drawn location as game coordinates, when the host pinned it on the map, and
`null` when they only named a place (older sites omit the field entirely). `radius` is how many
squares from it still counts, measured Chebyshev-style — `max(|dx|, |dy|)`.

`maxSessionMinutes` is how long the game session may have been running when the shot is taken,
`0` when the host isn't asking. The point is the LOGOUT before it: hiscores only flush on
logout, so a player who has been logged in since before the event has a stale start baseline.
A plugin that supports this should refuse to file a session older than the window and say so —
"log out and back in, then take the shot" — rather than filing something staff must chase.

Filing one: upload the PNG through `POST /api/upload` as usual, then
`POST /api/events/:eventId/start-proof` with plugin-token auth and
`{ imageUrl, keyword, capturedAt, x, y, loginAt }`, where `x`/`y` are the account's world
position at capture and `loginAt` is when this session began (both optional; omit what you
can't answer). The server recomputes the keyword, measures the distance and ages the session,
and answers `{ status, keywordOk, positionOk, distance, sessionMinutes, sessionOk }` — each
check `null` when it couldn't run. A plugin capture that passes every check it could run is
accepted outright (the host can turn that off); anything else lands `pending` for staff review,
including a shot filed from the wrong side of the world. `409` means the event hasn't drawn yet
or the player's shot is already accepted.

The gate is on submissions, not on the plugin: a credit from a player with no shot on file is
either flagged for review or refused with `409 { code: "start_proof_required" }`, per the
host's setting. A plugin that sees that code should KEEP the pending submission on disk and
retry after the player files their shot, rather than dropping the drop.

### `progress`

Account progress the hiscores never publish: quest points, combat-achievement points and tier,
achievement diaries per tier. `POST /api/plugin/progress`:

```json
{ "progress": [
  { "key": "questPoints", "value": 302 },
  { "key": "caPoints", "value": 1465 },
  { "key": "caTier", "value": 4 },
  { "key": "diaryElite", "value": 7 }
] }
```

Member-level auth (`Bearer <accountToken>` + `X-RSN`) — this is account state, not event scoring, so
no live event is required and nothing here moves a standing.

Send only the keys whose value **changed** since the last successful push: the server writes only
what moved, so the steady state is no request at all. Values are **max-merged**, because none of
these can go down in a live game — a lower number means a client that read a varbit before the game
populated it, which is what every login looks like for a few ticks. Unknown keys are dropped
individually rather than failing the request, so a newer plugin can add one before the server knows
it. The accepted keys are `questPoints`, `questsCompleted`, `caPoints`, `caTier` (0 = none … 6 =
Grandmaster), `caTiers` (a bitmask, bit 0 Easy … bit 5 Grandmaster, so a profile can light every
cleared tier rather than only the highest), the four counts `diaryEasy` / `diaryMedium` /
`diaryHard` / `diaryElite`, and one mask per region — `diaryArdougne`, `diaryDesert`,
`diaryFalador`, `diaryFremennik`, `diaryKandarin`, `diaryKaramja`, `diaryKourend`,
`diaryLumbridge`, `diaryMorytania`, `diaryVarrock`, `diaryWestern`, `diaryWilderness` — whose value
is `1` easy | `2` medium | `4` hard | `8` elite. Send both the counts and the masks: the counts are
what an older server understands, the masks are what a profile grid draws.

A push may also carry item LISTS — the quests themselves, not just how many:

```json
{ "items": [ { "category": "quest", "items": [
  { "id": 26, "name": "Dragon Slayer II", "state": 0 },
  { "id": 12, "name": "Cook's Assistant", "state": 2 }
] } ] }
```

`state` is the game's own three: `0` not started, `1` in progress, `2` finished. Send EVERY quest,
not only the finished ones — "which of these haven't I done" is the question the list exists to
answer, and a list of completions can't answer it. Names travel with the ids so the server needs no
quest dataset of its own, and one released next month lists itself. The list is stored whole and
only when it differs from what's held, so re-sending an unchanged list costs one comparison. The
category `ca` is filled from the varps below rather than from a list the plugin builds.

Combat tasks aren't sent as a list at all. The game bit-packs completion across a set of player
varps — task `i` is bit `i % 32` of the `i / 32`-th varp — so `/api/plugin/config` carries `caVarps`
(the ids, in bit order) and the plugin sends back what it read, alongside the game's own point
total:

```json
{ "caVarps": { "3116": 4294967295, "3117": 131071 }, "caPoints": 1472 }
```

The plugin understands none of it. The server decodes those bits against the task catalogue it
already ships and **discards the entire decode unless the points it implies equal `caPoints`
exactly** — hundreds of tasks reconciling to one authoritative total is not something a shifted bit
layout achieves by accident. A mismatch stores nothing, so an absent list always means "we don't
know", never "none completed". A game update that adds a varp is then a data change on the server
rather than a plugin release.

Diary counts are regions completed at that tier. Karamja's easy, medium and hard have no completion
varbit — the game tracks them as task counts whose totals would have to be hardcoded — so eleven
regions are counted at those three tiers and twelve at elite. The site says so where it shows them.

### `moments`

The highlight feed: pets, uniques, big hauls, deaths and combat tasks that happen while a
competition week or a bingo is running. `POST /api/plugin/moments`:

```json
{ "moments": [
  { "kind": "pet", "itemId": 20693, "itemName": "Rift guardian", "source": "Guardians of the Rift",
    "kc": 210, "at": "2026-08-17T10:00:00Z", "key": "pet-1755420000000" },
  { "kind": "drop", "itemId": 12922, "itemName": "Tanzanite fang", "quantity": 1,
    "valueGp": 3100000, "source": "Zulrah", "sourceKind": "npc", "kc": 1204, "at": "...", "key": "..." },
  { "kind": "death", "source": "Great Olm", "at": "...", "key": "death-1755420100000" },
  { "kind": "ca", "taskName": "Perfect Zulrah", "tier": "Master", "at": "...", "key": "ca|perfect zulrah|..." }
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

A `ca` observation carries only the task name and the tier the completion line claimed. Which boss
it belongs to comes from the server's own CA dataset (`src/data/combatAchievements.json`, the same
one the CA tile picker uses), which is what lets a task land on the week racing that boss without
the plugin knowing a week exists. `tier` is a fallback, read only for a task the dataset doesn't
carry yet. Two floors apply, both server-side so a clan can be retuned without a release: **Hard+**
for a task about the boss being raced or a source the board names, **Master+** for anything else
during a bingo. Only FIRST completions should be sent — the in-game "Repeat completion" setting
re-fires the same chat line for tasks cleared years ago, and the plugin tells them apart by whether
the CA points varbit actually rose.

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

## Addressing: one site, every clan

`anvilosrs.com` is the canonical address. It names no clan, and that is deliberate — a person
should not have to know a slug, and should not have to change anything when they join a second
clan.

The clan for a plugin request is resolved in this order:

1. **`/c/<slug>/api/plugin/…`** — someone typed it, so it wins
2. **the `Host`** — the per-clan subdomains installed plugins still have stored
3. **the bearer token** — the canonical path: the token names a person, whose seats name their clans

Steps 1 and 2 exist only for addresses already in the wild; both keep working indefinitely.

When the token has to decide between several clans:

- a **live event** wins, and between two live events the **latest start** does — the same tie-break
  already applied when one clan runs two boards
- with nothing live, the **most recently joined seat**
- a **roster sync** (`/api/plugin/clan-sync`) instead matches the in-game clan name it carries
  against the person's seats, because that is exact where the others are guesses, and it writes

`/api/plugin/schedule` and `/api/plugin/active-weekly` are unauthenticated, so they have no token to
resolve through and answer empty on the apex. Both are legacy endpoints for older jars; newer builds
read the same data merged into `/config`.

### Which clan answered, and which others there are

**Capability: `clan-switch`.** Both `/config` shapes carry:

```jsonc
{
  "activeClan": { "slug": "theafkspot", "name": "The AFK Spot" },
  "clans": [
    { "slug": "theafkspot", "name": "The AFK Spot", "kind": "member",
      "live": { "eventName": "Summer Bingo", "tilesComplete": 12, "tilesTotal": 25, "pointsScored": false } },
    { "slug": "vanguard", "name": "Iron Vanguard", "kind": "guest", "live": null }
  ]
}
```

`activeClan` is the clan this response is about, however it was named. `clans[]` is every clan the
token's owner holds a live seat in — suspended clans excluded, since picking one would 404 — newest
seat first, one row per clan even when they hold a main and an alt there. Built by `lib/pluginClans`;
part of `/config` rather than an endpoint of its own because clients already poll it on a timer.

**A client is expected to echo `activeClan.slug` back as a `/c/<slug>` prefix.** Resolution order 1
then wins, and the clan stops being re-guessed per request. That matters beyond tidiness: the routes
a plugin calls OUTSIDE `/api/plugin` — `POST /api/events/:id/submissions`, `POST
/api/events/:id/start-proof`, `POST /api/upload` — resolve a clan from the **address only**, so on
the canonical address they resolve to nothing unless the caller addresses one. Echoing the slug is
what makes them work there.

The one call that should stay unaddressed while a member has made no explicit choice is `/config`
itself, so the site keeps deciding and a member whose live board moves to their other clan follows
it. `/api/plugin/auth/start` and `/auth/poll` are never addressed — they are about a person who does
not have a clan yet.

### Telling a plugin where to go

`server.canonicalUrl` on every `/config` shape carries the address the deployment prefers, and the
`apex-routing` capability says it can resolve a clan without one. A plugin should suggest moving
only when it sees **both** — a site that cannot do token resolution must keep its per-clan address,
and being moved off it would break tracking.

Server-advertised rather than baked into the plugin, because Anvil is self-hostable: a hard-coded
domain would tell every self-hoster to point at somebody else's server.
