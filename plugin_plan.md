# OSRS Bingo RuneLite Plugin — Implementation Plan

## Goal

Build a RuneLite plugin that:
1. Displays a verification overlay (codeword + date) on screen for evidence screenshots
2. Auto-detects tracked bingo drops, screenshots them, and submits to the bingo site with zero manual effort

---

## Architecture

```
┌─────────────────────────┐            ┌────────────────────────────┐
│    RuneLite Plugin       │            │    Next.js Bingo App       │
│    (Java)                │            │                            │
│                          │            │                            │
│  OsrsBingoConfig         │  Bearer    │  GET /api/plugin/config    │
│  (playerToken, siteUrl)  │──token────▶│  (tracked drops, codeword) │
│                          │            │                            │
│  OsrsBingoOverlay        │            │                            │
│  (codeword, date, drops) │            │                            │
│                          │            │                            │
│  OsrsBingoPlugin         │  POST      │  POST /api/upload          │
│  (LootReceived listener) │──────────▶│  POST /api/.../submissions │
│    └─ screenshot          │            │    └─ auto-completion sync │
│    └─ upload              │            │    └─ Discord webhook      │
│    └─ submit              │            │                            │
└─────────────────────────┘            └────────────────────────────┘
```

---

## Part 1: API Changes (Next.js App)

### 1.1 — Schema: Add `trackedItemIds` to tiles

Add a `trackedItemIds` text column to the `tiles` table. Stores a JSON array of OSRS item IDs that map to each drop tile.

```ts
// src/db/schema.ts — tiles table
trackedItemIds: text('tracked_item_ids'), // e.g. '[13576]' for Dragon Warhammer
```

- Only relevant for `tileType = 'drop'` tiles
- Admin enters item IDs when creating/editing drop tiles
- Multiple IDs supported (e.g. `[13576, 13577]` for variants)

### 1.2 — Auth: Add `verifyPluginToken()` helper

New function in `src/lib/auth.ts` that resolves a `playerToken` UUID from an `Authorization: Bearer <token>` header to the player's identity.

```ts
export async function verifyPluginToken(
  request: Request
): Promise<{ playerId: number; teamId: number; eventId: number } | null>
```

- Reads `Authorization` header
- Looks up player by `playerToken` in DB
- Returns `{ playerId, teamId, eventId }` or null
- No new tokens or secrets needed — reuses the existing `playerToken` UUID

### 1.3 — New Endpoint: `GET /api/plugin/config`

Returns everything the plugin needs on startup:

```json
{
  "event": { "id": 1, "name": "Bingo #4", "startDate": "...", "endDate": "..." },
  "team": { "id": 3, "name": "Iron Giants", "color": "#e74c3c" },
  "player": { "id": 12 },
  "codeword": "A3F2B1",
  "trackedDrops": [
    {
      "tileId": 5,
      "label": "Dragon Warhammer",
      "itemIds": [13576],
      "requiredAmount": 1,
      "currentAmount": 0
    }
  ]
}
```

**Codeword generation:** Deterministic daily rotation using `HMAC-SHA256(playerId:eventId:YYYY-MM-DD, secret)` truncated to 6 hex chars. Can be verified server-side from any screenshot after the fact.

### 1.4 — Bearer Token Fallback in Existing Endpoints

Add plugin token auth as a fallback in two existing route handlers:

- `POST /api/upload` — so the plugin can upload screenshots
- `POST /api/events/[eventId]/submissions` — so the plugin can create submissions

Pattern: at the top of each handler, after existing cookie auth checks fail, try `verifyPluginToken(request)` and treat it as player auth.

### 1.5 — Admin UI: Item ID Input for Drop Tiles

Add an input field to the tile editor for drop-type tiles where admins can enter OSRS item IDs. Simple comma-separated input or JSON array. Stored as `trackedItemIds` in the DB.

---

## Part 2: RuneLite Plugin (Java)

### 2.1 — Project Setup

```
osrs-bingo-plugin/
├── src/main/java/com/osrsbingo/
│   ├── OsrsBingoPlugin.java        // Main plugin class
│   ├── OsrsBingoConfig.java        // RuneLite config interface
│   ├── OsrsBingoOverlay.java       // Screen overlay
│   ├── BingoApiClient.java         // HTTP client
│   ├── TrackedDrop.java            // Drop tile POJO
│   └── PluginConfig.java           // Config response POJO
├── build.gradle                     // RuneLite plugin build
└── runelite-plugin.properties       // Plugin metadata
```

Dependencies: RuneLite API, OkHttp (bundled with RuneLite), Gson (bundled with RuneLite).

### 2.2 — `OsrsBingoConfig` — Settings Panel

User-configurable settings in RuneLite's config panel:

| Setting | Type | Description |
|---|---|---|
| `apiUrl` | String | Bingo site URL (e.g. `https://yourbingo.vercel.app`) |
| `playerToken` | String | Player token UUID from the bingo site |
| `autoSubmit` | Boolean | Auto-screenshot and submit on tracked drops (default: true) |
| `showOverlay` | Boolean | Show codeword/date overlay (default: true) |

### 2.3 — `OsrsBingoPlugin` — Main Plugin

Lifecycle:
- **startUp():** Register overlay, create executor thread, init API client, fetch config
- **shutDown():** Remove overlay, shutdown executor

Event subscriptions:
- **onLootReceived(LootReceived):** Core drop detection logic
  1. Iterate loot items against `trackedDrops[].itemIds`
  2. Skip if tile already at `requiredAmount`
  3. On match → call `captureAndSubmit()`

Background tasks:
- **Config refresh:** Poll `GET /api/plugin/config` every 5 minutes to pick up new tiles, updated progress, fresh codeword

### 2.4 — `OsrsBingoOverlay` — Verification Overlay

Renders an `OverlayPanel` at `TOP_LEFT` position:

```
┌──────────────┐
│ OSRS Bingo   │  ← Yellow title
│ Code: A3F2B1 │  ← Green, rotates daily
│ Date: 2026-02│  ← Current date
│ Drops: 2/5   │  ← Green when all complete
└──────────────┘
```

- Uses `TitleComponent` and `LineComponent` (standard RuneLite overlay API)
- Only renders when `showOverlay` is enabled and config is loaded
- Codeword is fetched from API (server-generated, deterministic)
- Visible in screenshots = tamper-evident proof

### 2.5 — `BingoApiClient` — HTTP Client

Three methods:

1. **`fetchConfig()`** — `GET /api/plugin/config`
   - Sends `Authorization: Bearer <playerToken>`
   - Parses response into `PluginConfig` POJO
   - Caches `eventId`, `teamId`, `playerId` for submissions

2. **`uploadImage(byte[] png, String filename)`** — `POST /api/upload`
   - Multipart form data with PNG bytes
   - Returns the Vercel Blob URL string

3. **`submitDrop(int tileId, int amount, String imageUrl, String note)`** — `POST /api/events/{eventId}/submissions`
   - JSON body: `{ tileId, teamId, amount, imageUrl, note, creditPlayerId }`
   - Server handles completion sync + Discord notification

All methods attach `Authorization: Bearer <playerToken>` header.

### 2.6 — Screenshot + Submit Flow

Triggered by `onLootReceived` when a tracked item is detected:

```
LootReceived fires
  → item ID matches trackedDrops[i].itemIds
  → drawManager.requestNextFrameListener(image -> { ... })
      → ImageIO.write(image, "png", byteStream)     // capture frame
      → apiClient.uploadImage(bytes, "drop.png")     // upload to site
      → apiClient.submitDrop(tileId, amount, url)    // create submission
      → update local drop.currentAmount              // optimistic update
```

- Runs on a background executor thread (not game thread)
- `drawManager` captures the frame with the overlay visible (codeword in screenshot)
- Failures are logged but don't crash the plugin

---

## Drop Detection Details

### How RuneLite's `LootReceived` works

- Fires after killing an NPC and loot appears
- Provides `event.getName()` (NPC name) and `event.getItems()` (list of `ItemStack`)
- Each `ItemStack` has `.getId()` (OSRS item ID) and `.getQuantity()`
- This is the same event used by RuneLite's built-in Loot Tracker

### Item ID reference

Admins need to enter OSRS item IDs for each drop tile. These can be looked up at:
- https://www.osrsbox.com/tools/item-search/
- RuneLite's item database
- OSRS Wiki item pages (infobox shows ID)

Examples:
| Drop | Item ID |
|---|---|
| Dragon Warhammer | 13576 |
| Twisted Bow | 20997 |
| Tumeken's Shadow | 27277 |
| Dragon Pickaxe | 11920 |
| Enhanced Crystal Weapon Seed | 25859 |
| Olmlet | 20851 |

---

## Security Considerations

- **playerToken** is a UUID — sufficient entropy, already unique-indexed in DB
- **Codeword** is HMAC-derived — cannot be predicted without the server secret
- **Bearer token over HTTPS** — standard auth pattern, no cookies needed
- **Rate limiting** — consider adding rate limits to plugin endpoints (e.g. max 1 submission per 10 seconds per player)
- **Image validation** — existing upload endpoint already validates MIME type and size (10MB max)
- **Team isolation** — existing submission endpoint already enforces team membership

---

## Implementation Checklist

### API Changes (Next.js)

- [ ] Add `trackedItemIds` text column to `tiles` table in `src/db/schema.ts`
- [ ] Run Drizzle migration (`npx drizzle-kit generate && npx drizzle-kit push`)
- [ ] Add `verifyPluginToken()` function to `src/lib/auth.ts`
- [ ] Create `GET /api/plugin/config` endpoint with codeword generation
- [ ] Add bearer token auth fallback to `POST /api/upload`
- [ ] Add bearer token auth fallback to `POST /api/events/[eventId]/submissions`
- [ ] Add item ID input field to admin tile editor UI (drop tiles only)
- [ ] Add `CODEWORD_SECRET` to environment variables
- [ ] Test full flow: plugin config fetch → upload → submission → Discord notification

### RuneLite Plugin (Java)

- [ ] Initialize Gradle project with RuneLite plugin template
- [ ] Implement `OsrsBingoConfig` — settings panel (apiUrl, playerToken, toggles)
- [ ] Implement `TrackedDrop` and `PluginConfig` POJOs
- [ ] Implement `BingoApiClient` — fetchConfig, uploadImage, submitDrop
- [ ] Implement `OsrsBingoOverlay` — codeword, date, drop progress
- [ ] Implement `OsrsBingoPlugin` — LootReceived listener, config refresh loop
- [ ] Implement `captureAndSubmit` — screenshot → upload → submit pipeline
- [ ] Handle edge cases: no config loaded, API errors, duplicate submissions
- [ ] Test with RuneLite developer mode against local bingo site
- [ ] Submit to RuneLite Plugin Hub (or distribute as external plugin)

### Optional Enhancements (Post-MVP)

- [ ] Chat notification in-game when drop is successfully submitted
- [ ] Manual submit button (for drops the auto-detect misses)
- [ ] Side panel showing all tracked tiles and progress
- [ ] Sound effect on successful submission
- [ ] Retry queue for failed uploads (offline/server down)
- [ ] Collection log detection via `ChatMessage` events (stretch goal)
