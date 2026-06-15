# Anvil — All-in-One Notifications Plan

## Goal

Fold the behavior of Dink + Discord Rare Drop Notificater into **Anvil** (`com.osrsbingo`)
so a clan member installs **one** plugin instead of a stack of them. New surface:

1. **Rare drop notifier** — post non-bingo rare/valuable drops (and pets) to a clan Discord channel.
2. **Death notifier** — post a message when the local player dies, with a **1/100 chance** of a
   random "fun" line instead of the user's configured message.
3. **Centralized, server-managed webhooks** — the plugin fetches the Discord webhook URLs from the
   site **on every launch**. Remap a channel server-side → the next launch picks it up. No jar
   re-release to change destinations.

This builds directly on what Anvil already has: a `LootReceived`/`NpcLootReceived` pipeline, a
config-fetch-on-init pattern (`GET /api/plugin/config`), player-token auth, and the side panel.

---

## Notification taxonomy — who posts what

Not everything should be plugin-posted. Split by **where the event originates** and **whether it
needs persistence**:

| Category | Originates | Persistence? | Who posts | Webhook source |
|---|---|---|---|---|
| Bingo submission / completion | Site (DB write) | Yes (stored) | **Server** (existing `notifySubmission`, `notifyTileCompletion`) | `discord_webhook_url` (server-only) |
| Event start / end / draft | Site (cron / admin) | Yes | **Server** (existing `notifyEventStart`, etc.) | `discord_webhook_url` (server-only) |
| **Rare drop (non-bingo)** | Plugin (in-game loot) | **No** | **Plugin → Discord directly** | fetched on launch |
| **Death** | Plugin (in-game death) | **No** | **Plugin → Discord directly** | fetched on launch |
| Plugin update | GitHub release | No | GitHub release webhook *(out of scope — see note)* | n/a |

**Key principle (the user's call):** rare drops and deaths are throwaway — the site neither stores
nor needs them. Routing them through the server would add request load and store screenshots we'd
immediately discard. So the plugin posts these **straight to Discord**, including screenshots via
Discord's multipart upload. **Zero hits on `/api/upload`.**

Bingo drops are different — they need server processing (submission row, progress, evidence
screenshot), so they keep going through the existing authenticated `/api/upload` +
`/api/events/{id}/submissions` path. Unchanged.

> Plugin-update notifications: easiest path is a GitHub Actions release webhook posting to Discord,
> independent of the plugin. Listed for completeness; not part of this plan.

---

## Webhook ownership — decision & residual risk

**Decision:** the site stores the webhook URLs; the plugin **fetches them on every launch** and posts
directly to Discord.

**Why this is fine:**
- URLs are **not baked into the jar** — they're fetched live, so changing a destination is a
  server-side edit, picked up on the next client launch. No re-release.
- **Rotation = revocation.** If a URL leaks and gets abused, delete/recreate the Discord webhook,
  paste the new URL in the admin settings, done. Every client self-heals on next launch.

**Residual risk (accept knowingly):** at runtime the *current* URL is in client memory and on the
wire, so a malicious clan member can sniff it and spam that channel **until you rotate**. This is a
real but bounded risk for a clan-internal tool, and rotation is cheap. Note this differs from
Dink/Rare Drop Notificater, where each *user* pastes their *own* webhook — there a leak is the
user's problem; here the webhooks are **yours**, so abuse hits your channels.

**Optional hardening (take or leave — none required for v1):**
- Gate the webhook payload behind the existing **player token** so the URLs aren't returned to
  anonymous callers. (Cheap; recommended.)
- Only return webhooks when the caller's `X-RSN` matches a known/enrolled `clanMember`, so random
  token holders outside the clan don't receive them.
- Point these webhooks at **dedicated low-stakes channels** you don't mind rotating.
- Per-launch server-side rate-limit hint isn't enforceable (plugin posts directly), so rely on
  Discord's own per-webhook rate limits + rotation.

---

## Part 1 — Server changes (Next.js)

### 1.1 New settings keys

`settings` is a key/value table. Add two keys for the plugin-posted channels (bingo/event posting
keeps using `discord_webhook_url`, server-side only):

```
webhook_rare_drops   — Discord webhook URL for rare drop posts
webhook_deaths       — Discord webhook URL for death posts
```

Expose them to the admin settings API by extending `EXPOSED_KEYS` in
`src/app/api/admin/settings/route.ts`:

```ts
const EXPOSED_KEYS = [
  'discord_webhook_url',
  'clan_name',
  'webhook_rare_drops',   // new
  'webhook_deaths',       // new
] as const;
```

The existing `PUT` (upsert/trim) and `POST { action: 'test' }` (send test webhook) handlers already
work generically — the new keys ride along for free, including the per-URL "Test" button.

### 1.2 Make `GET /api/plugin/config` the single read-bootstrap

**Decision: merge the reads.** Fold the existing `GET /api/plugin/schedule` and
`GET /api/plugin/active-weekly` payloads, plus the new `webhooks` and `funDeathMessages`, into the
`GET /api/plugin/config` response. This takes the plugin's login reads from 3 calls to 1. The two
**mutating** POSTs (`/api/plugin/hello`, `/api/plugin/weekly/enroll`) stay as-is — their per-login
side-effect semantics are already shipped and working (see `PLUGIN_BACKLOG.md`), and folding
side effects into a GET would be wrong.

Add all four blocks to the response (`src/app/api/plugin/config/route.ts`), in **both** the
active-event branch and the `noActiveEvent: true` branch — deaths/rare drops/schedule should resolve
even when the player isn't in a live bingo:

```jsonc
{
  "event": { ... } | null,
  "team":  { ... } | null,
  // ...existing config fields...

  // --- merged from /api/plugin/schedule ---
  "schedule": { "bingos": [...], "weeklies": [...] },

  // --- merged from /api/plugin/active-weekly ---
  "activeWeekly": { "id": 1, "title": "...", "type": "...", "metric": "..." } | null,

  // --- new: plugin-posted notification destinations ---
  "webhooks": {
    "rareDrops": "https://discord.com/api/webhooks/..." | null,
    "deaths":    "https://discord.com/api/webhooks/..." | null
  },

  // --- new: server-managed fun-death pool (edit without a jar release) ---
  "funDeathMessages": [
    "{name} has been sent to Lumbridge to think about their choices.",
    "{name} forgot to turn on Protect from Magic. Classic."
  ]
}
```

Implementation note: lift the body-building logic out of the existing `schedule` and `active-weekly`
route handlers into a shared helper (e.g. `src/lib/pluginConfig.ts`) and call it from both the
config route and the old standalone routes — keep the old endpoints alive for one release so an
older jar doesn't break, then deprecate.

`funDeathMessages` source: hardcode the list in the config route (or a `src/lib/constants.ts`
export) for v1 — no new table needed. Promote to a `settings` key or its own table later only if you
want to edit it from the admin UI.

> Gating: the endpoint is already behind `verifyPluginToken` / `verifyPluginTokenUser`, so `webhooks`
> isn't returned to anonymous callers. The `noActiveEvent` branch is reached with a valid token but
> no live event — exactly when we still want deaths/drops/schedule to resolve.

### 1.3 Admin UI

In `src/app/admin/integrations/page.tsx` (the existing Discord settings page), add two more
webhook fields next to the current one — "Rare drops channel" and "Deaths channel" — each with the
existing **Test** button wired to `POST /api/admin/settings { action: 'test', webhook_url }`. No new
endpoint needed.

**Server work is small:** 2 settings keys, ~6 lines in the config route, 2 UI fields. No schema
migration (key/value table), no new endpoint.

---

## Part 2 — Plugin changes (Java, `com.osrsbingo`)

### 2.1 Config — new "Notifications" section in `OsrsBingoConfig`

Add a `@ConfigSection` (`closedByDefault = false`) with:

```java
// --- Rare drops ---
boolean notifyRareDrops      (default true)
int     rareDropMinValue     (default 1_000_000)   // GE/HA max, same metric as Rare Drop Notificater
boolean rareDropScreenshot   (default true)
boolean notifyPets           (default true)        // pets have no GE value — gate separately

// --- Deaths ---
boolean notifyDeaths         (default true)
String  deathMessage         (default "{name} just died!")   // {name} token replaced with RSN
boolean deathScreenshot      (default true)                  // ON — capture the death like Death Notifier
```

`deathMessage` (the user's own line) stays **local in the plugin** config. The **fun-message pool is
now server-served** via `funDeathMessages` in the merged config response (§1.2) — since we make that
call anyway, the pool rides along for free and you can edit gags without a jar release. The plugin
keeps a small baked-in `FUN_DEATHS` fallback for when it's offline or the field is empty (see 2.4).

### 2.2 POJO — merged fields on `PluginConfigResponse`

The config response now carries the merged reads + new data. Add to `PluginConfigResponse`:

```java
public Webhooks webhooks;
public List<String> funDeathMessages;          // server-served fun-death pool (may be null/empty)
public BingoApiClient.ScheduleResponse schedule;     // merged from /api/plugin/schedule
public BingoApiClient.ActiveWeekly activeWeekly;     // merged from /api/plugin/active-weekly

public static class Webhooks {
    public String rareDrops;  // nullable
    public String deaths;     // nullable
}
```

Anvil already calls `apiClient.fetchConfig()` in `refreshConfig()` on login and stores
`pluginConfig`, so all of these populate for free on every launch/login. To honor "fetch on every
RuneLite launch," ensure `refreshConfig()` runs from `startUp()` (or the first
`GameStateChanged → LOGGED_IN`), which it effectively already does.

**Plugin call-site cleanup (reads merged 3 → 1):** the side panel / login flow should now read
`pluginConfig.schedule` and `pluginConfig.activeWeekly` instead of calling
`apiClient.fetchSchedule()` and `apiClient.fetchActiveWeekly()` separately. Keep those client methods
for one release as a fallback, then remove. The auto-enroll POST still uses `pluginConfig.activeWeekly`
to decide whether to call `enrollWeekly(rsn)` — unchanged, just sourced from the merged payload.

### 2.3 New `DiscordWebhookClient` (plugin-side, posts to discord.com)

Keep this **separate** from `BingoApiClient` — it talks to `discord.com`, not the site, and carries
no auth header. Two send paths:

```java
void send(String webhookUrl, String content, JsonObject embed);          // text/embed, no image
void sendWithImage(String webhookUrl, String content, JsonObject embed,  // multipart: payload_json + files[0]
                   byte[] png, String filename);
```

`sendWithImage` uses Discord's multipart format (`payload_json` part + `files[0]` part) so the
screenshot goes **straight to Discord** — no `/api/upload`. To render the shot inside an embed, set
`embed.image.url = "attachment://" + filename`.

**Threading / performance (hard requirement — must not slow the client):**
- Both methods use OkHttp's **async** `enqueue()` so the network round-trip runs on OkHttp's own
  dispatcher — off the game thread *and* off the plugin's single executor. A slow Discord response
  can never stall a config refresh or a bingo submission.
- Fire-and-forget: a `Callback` that only logs at debug on failure/non-2xx. No retry queue, no disk
  persistence (these are throwaway, unlike bingo drops). Drop on 429 + log.
- These posts do **not** reuse `PendingSubmissionStore` or `captureAndSubmit` (those persist + retry
  for bingo). They use a lighter `captureFrameAsync` helper (see 2.6).

### 2.4 Death handling — `onActorDeath`

```java
@Subscribe
public void onActorDeath(ActorDeath e) {                      // fires on client thread — keep cheap
    if (!config.notifyDeaths()) return;
    if (e.getActor() != client.getLocalPlayer()) return;     // local player only (ref check, cheap)
    String url = webhookUrlFor("deaths");
    if (url == null) return;

    String rsn = getLocalPlayerName();
    String msg = buildDeathMessage(rsn);                      // 1/100 fun line, else custom
    if (config.deathScreenshot()) {
        captureFrameAsync(png -> discordClient.sendWithImage(url, msg, null, png, "anvil-death.png"));
    } else {
        discordClient.send(url, msg, null);
    }
}
```

The screenshot is requested the instant `ActorDeath` fires, so the death scene is in frame (same
timing Death Notifier uses). Encode + send happen off-thread (see 2.3 / 2.6).

**1/100 fun roll:** `Math.random() < 0.01` (or `ThreadLocalRandom`). The pool comes from
`pluginConfig.funDeathMessages` (server-served, §1.2). The baked-in constant is only a **fallback**
for when the server list is null/empty or the plugin is offline:

```java
// fallback only — primary source is pluginConfig.funDeathMessages
private static final List<String> FUN_DEATHS_FALLBACK = List.of(
    "{name} has been sent to Lumbridge to think about their choices.",
    "{name} forgot to turn on Protect from Magic. Classic.",
    "{name} died doing what they loved: not eating.",
    "GG {name}, the gravestone fund thanks you.",
    "{name} alt-F4'd in real life."
);
```

`pickFun(rsn)` reads the server list (falling back to `FUN_DEATHS_FALLBACK` if empty), picks a
random entry, and substitutes `{name}`.

> Note: `ActorDeath` fires on the death *animation*, which is the right trigger for a "you died"
> message (it does not require Hardcore/region logic). It can fire for safe-deaths too — acceptable
> for a fun notifier; add a region/`isInInstance` guard later only if it gets noisy.

### 2.5 Rare drop handling — extend the existing loot path

Anvil already handles `onNpcLootReceived` / `onLootReceived` / `onPlayerLootReceived` for bingo, with
NPC-vs-aggregate dedup. A **parallel, independent** `maybeNotifyRareDrop(source, items, sourceKind)`
runs in the same handlers. It fires on **three** triggers (a drop posts at most once per item, with
all applicable reasons shown):

1. **Per-item value** — `max(GE price, HA value) * quantity` via `ItemManager`. Posts if
   ≥ `rareDropMinValue`. Same metric Rare Drop Notificater uses.
2. **Rarity (1/N)** — for `npc` / `pickpocket` sources, look up the drop's wiki-scraped rarity and
   post if it's rarer than `rareDropMinRarity` (1-in-N), *regardless of value*. Catches notable-
   but-cheap uniques (jars, untradeables) that value misses. Backed by the ported Dink rarity
   engine (see below). `0` disables.
3. **Aggregate loot value** — sums the whole drop and posts a "📦 Big loot!" summary if the total
   clears `aggregateLootMinValue`, **even when no single item qualifies**. This is what catches
   **large loot keys** / raid piles. Skipped when a standout item already posted, to avoid double-
   reporting. Deduped by source name (NPC kills fire NpcLoot + LootReceived back-to-back). `0`
   disables.

- **Pets:** pets don't fire `LootReceived` and have no GE value — handled in the existing
  `onChatMessage` pet branch. If `notifyPets`, post a "🐾 Pet drop!" embed there.
- **Orthogonal to bingo submission:** a drop can be both a bingo tile item *and* a rare-drop post,
  or either alone. The two code paths share only the loot event.

**Rarity engine (ported from Dink, BSD-2 — see `plugin/THIRD_PARTY_NOTICES.md`):**
- `npc_drops.json` (~718 KB) + `thieving.json` (~0.7 KB) bundled under `src/main/resources/`.
- `AbstractRarityService` / `RarityService` (NPC) / `ThievingService` (pickpocket) + a trimmed
  `MathUtils` (binomial, for multi-roll drops). `RarityService.getRarity(source, itemId, qty)`
  returns an `OptionalDouble` probability, summed across matching drop-table entries / variants.
- Rarity is keyed by **source name** (the NPC/source string the loot event already provides) and
  only resolves for NPC + pickpocket; pvp/event loot relies on value + aggregate.
- To refresh the dataset later, re-pull `npc_drops.json` / `thieving.json` from DinkPlugin `master`.

### 2.6 Screenshots — `captureFrameAsync` helper (no client slowdown)

Add a lightweight helper that captures a frame and hands the PNG bytes off-thread, **without** the
disk-persist/retry machinery of `captureAndSubmit` (deaths/rare drops are throwaway):

```java
private void captureFrameAsync(java.util.function.Consumer<byte[]> consumer) {
    drawManager.requestNextFrameListener(image -> {          // runs on client/AWT thread
        if (executor == null || executor.isShutdown()) return;
        executor.submit(() -> {                              // encode OFF the client thread
            try {
                BufferedImage buffered = (BufferedImage) image;
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(buffered, "png", baos);
                consumer.accept(baos.toByteArray());         // consumer posts via OkHttp async
            } catch (Exception ex) {
                log.debug("Anvil frame capture failed: {}", ex.getMessage());
            }
        });
    });
}
```

Performance contract end-to-end: **client thread** → ref check + request frame (cheap);
**executor** → PNG encode; **OkHttp dispatcher** → network. The game loop never waits on encoding or
the network. Gate captures by `rareDropScreenshot` / `deathScreenshot`.

---

## Security & abuse notes (carried from the decision above)

- Webhook URLs are fetched live and **rotatable server-side** — rotation is the revocation path.
- Recommended cheap hardening: keep the `webhooks` block behind the player token (already true if
  added to `/api/plugin/config`), and point these at dedicated channels.
- The plugin posts directly to Discord, so server-side rate-limiting can't apply — rely on Discord's
  per-webhook limits; `DiscordWebhookClient` drops + logs on 429.

---

## Implementation checklist

### Server (Next.js)
- [ ] Add `webhook_rare_drops`, `webhook_deaths` to `EXPOSED_KEYS` in `admin/settings/route.ts`
- [ ] Extract schedule + active-weekly body builders into a shared `src/lib/pluginConfig.ts` helper
- [ ] Merge `schedule`, `activeWeekly`, `webhooks`, `funDeathMessages` into **both branches** of
      `GET /api/plugin/config`
- [ ] Define `funDeathMessages` list (config route or `constants.ts`)
- [ ] Keep `/api/plugin/schedule` + `/api/plugin/active-weekly` alive one release, then deprecate
- [ ] Add two webhook fields + Test buttons to `admin/integrations/page.tsx`
- [ ] (Optional hardening) confirm `webhooks` only returned to token/RSN-validated callers

### Plugin (Java)
- [ ] Add "Notifications" `@ConfigSection` to `OsrsBingoConfig` (toggles, `rareDropMinValue`,
      `deathMessage`, screenshot flags)
- [ ] Add `Webhooks` POJO + `funDeathMessages`, `schedule`, `activeWeekly` fields to `PluginConfigResponse`
- [ ] Point side panel / login flow at `pluginConfig.schedule` + `.activeWeekly` (drop the 2 separate calls)
- [ ] New `DiscordWebhookClient` — `send` + `sendWithImage` (multipart), fire-and-forget
- [ ] `FUN_DEATHS` constant + `rollFunMessage()` (1/100) + `pickFun(rsn)`
- [ ] `@Subscribe onActorDeath` — local-player filter, message build, optional screenshot, post
- [ ] Rare-drop value check inside existing loot handlers (independent of bingo submit)
- [ ] Pet post inside the existing `onChatMessage` pet branch (gated by `notifyPets`)
- [ ] Helper `webhookUrl(pluginConfig, key)` → null-safe getter
- [ ] Wire screenshot capture (reuse `captureAndSubmit`'s `DrawManager` util)

### Test
- [ ] Admin Test button posts to each new channel
- [ ] Die in-game → death post (run ~200 deaths or temporarily set roll to 1/2 to verify fun-line path)
- [ ] Receive a drop ≥ threshold → rare-drop post with screenshot; drop a pet → pet post
- [ ] Remap a webhook server-side → relaunch client → posts go to the new channel (no re-release)
- [ ] Confirm `/api/upload` is **not** hit by death/rare-drop posts (only by bingo submissions)
```