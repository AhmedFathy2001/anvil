# Plugin: Collection-Log Task UI + Admin-Only Sidebar — Build Plan

Status: **proposed** (awaiting review before implementation)
Scope: RuneLite plugin only (`plugin/`). No web-app changes required for the core; an
optional `favourites`/filter-state persistence is local config only.

---

## 1. Goal

Reshape the plugin's surface so it behaves like a Leagues / Grid-Master client:

1. **Sidebar = admin tools only.** Regular members get *no* RuneLite side panel.
2. **Member-facing tasks live inside the real in-game Collection Log.** A custom
   **"Bingo"** category is injected into the native collection log interface (group
   621), rendering tiles as clog-style entries (item icons, green = done / red = not).
3. **Leagues-style filtering inside that tab** — interactive in-game filter widgets
   (status / type / search), per the "Fully in-clog + filters" approach chosen.
4. **Drop / completion popups use a faithful Collection-Log unlock banner** (the real
   parchment banner look + unlock sound), replacing the current rounded-rect overlay.

---

## 2. Feasibility & precedents (verified)

| Feature | Verdict | Precedent |
|---|---|---|
| Hide sidebar for non-admins | Trivial | RuneLite `ClientToolbar.add/removeNavigation` |
| Inject a custom tab into the clog interface | Proven | `evansloan/collection-log` (`CollectionLogTab`, `CollectionLogPage`) |
| Interactive filters *inside* the clog widget | Possible, fragile | widget `setOnOpListener` + custom tab-state management |
| Leagues-style task filtering UX | Proven | `osrs-reldo/tasks-tracker-plugin` (area/tier/skill, favourites) |
| Faithful clog unlock banner | Replica only | `SpriteManager` + game sprites + `SoundEffectID` |

> **Honest caveat (banner):** we cannot make the game fire its *native* "New item added
> to your collection log" banner for a bingo task — that trigger is server-side and tied
> to genuine clog unlocks. We render a pixel-faithful **replica** overlay using the
> game's own sprites + sound. Looks identical; fully under our control.

> **Honest caveat (fragility):** injected clog widgets and the custom-tab click handling
> break whenever Jagex reshuffles the collection-log CS2 scripts/varbits. This needs
> occasional maintenance after game updates. Mitigation in §6.

Precedent sources:
- https://github.com/evansloan/collection-log
- https://github.com/osrs-reldo/tasks-tracker-plugin
- https://static.runelite.net/runelite-api/apidocs/net/runelite/api/ScriptID.html

---

## 3. Current state (what we're reshaping)

**Lifecycle / wiring** (`OsrsBingoPlugin.java`)
- `startUp()` (L284): adds `overlay`, `dropNotification`, builds `navButton`, calls
  `clientToolbar.addNavigation(navButton)` **unconditionally** (L304-310).
- `shutDown()` (L386): removes overlays + nav.
- `onConfigChanged` already exists (L405) with a debounced refresh (L1036).
- Admin gate already exists: `config.adminModeEnabled()` (default true, L198) +
  `hasAdminToken()` (token at `adminPluginToken`).

**Panel content** (`OsrsBingoPanel.java`, `rebuild()` L86)
- Admin link section (L118, `renderAdminSection` L343) — **stays (admin)**.
- Schedule + Weekly sections (L122/L125) — *member-facing*.
- Event / **Stat Tiles** (L234) / **Tracked Drops** (L246) / **Pending** (L266) —
  *member-facing* → these are what move into the clog.

**Task data already on the client** (`PluginConfigResponse.java`) — no new API needed:
- `trackedDrops[]`: `{tileId, label, itemIds[], requiredAmount, currentAmount,
  itemRequirements[]}` + `acceptedSources`.
- `trackedStats[]`: `{tileId, label, statName, statType, trackingMode, currentAmount,
  goalAmount}`.
- `event`, `team`, `player`.

**Current banner** (`BingoDropNotificationOverlay.java`) — hand-drawn rounded rect at
`TOP_CENTER`, `.show(label, current, required)` queue. This is the thing the replica
banner replaces.

---

## 4. Target architecture

```
OsrsBingoPlugin
 ├─ (admin only) NavigationButton → OsrsBingoPanel   // admin tools: link, clan sync, schedule mgmt
 ├─ ClogTabController            // NEW: injects + manages the in-game "Bingo" clog tab
 │    ├─ ClogTaskModel           // NEW: adapts trackedDrops/trackedStats → renderable rows + filter state
 │    └─ ClogFilterBar           // NEW: in-interface filter widgets (status/type/search)
 └─ BingoClogBannerOverlay       // NEW: replaces BingoDropNotificationOverlay (real-banner replica)
```

New files (all `src/main/java/com/osrsbingo/`):
- `ClogTabController.java` — all interface injection + tab-state + click handling.
- `ClogTaskModel.java` — pure data: merge drops+stats into `TaskRow {label, itemId,
  current, goal, type, status}`, apply active filters, sort.
- `ClogFilterBar.java` — builds/repaints the filter control widgets, owns filter state.
- `BingoClogBannerOverlay.java` — sprite-based banner replica (+ keep old overlay as
  fallback behind a config toggle during rollout).

---

## 5. Phased implementation

### Phase 1 — Admin-only sidebar  *(small, low-risk, ship first)*  ✅ DONE
> Implemented: `navAdded` flag + `updateNavVisibility()` gated on `hasAdminToken()`,
> wired into `startUp`/`shutDown`/`onConfigChanged`. Compiles + tests pass.

- Extract nav add/remove into `updateNavVisibility()`:
  `boolean showPanel = config.adminModeEnabled() && hasAdminToken();`
  add nav iff `showPanel` and not already added; remove iff shown and now false.
- Call it at end of `startUp()` and from `onConfigChanged` when key ∈
  {`adminModeEnabled`, `adminPluginToken`}.
- `shutDown()` still removes if present (guard double-remove).
- **Decision needed (§7-A):** where do member-facing *schedule / weekly-enrollment*
  actions go once the panel is gone? (They aren't tasks.) Recommendation: fold a
  "Schedule" subsection into the clog Bingo tab + keep weekly auto-enroll
  (`autoEnrollWeekly`) as the default so no manual UI is required; expose manual enroll
  via a chat command (`::bingo enroll`) as a lightweight fallback.

### Phase 2 — Inject the "Bingo" clog tab  *(core)*  🟡 SCAFFOLDED (compiles; needs live tuning)
> Done & verified here: `ClogTaskModel` (pure drops+stats→rows, filter/sort) + 7 JUnit
> tests passing; `ClogIds` constants; `ClogTabController` (state machine, event wiring via
> `WidgetLoaded`/`WidgetClosed`/`ScriptPostFired==COLLECTION_DRAW_LIST`, header rewrite,
> colour-coded task list); plugin delegators; `bingoClogTab` config toggle (default OFF).
> API pinned to 1.12.24 (`WidgetInfo`, not `ComponentID`).
>
> Needs a live RuneLite session (widget inspector) to finish — all isolated behind
> `TODO(live)` markers in `ClogTabController`: (a) match native tab sprite/geometry,
> (b) item-icon grid cells, (c) verify click-suppression vs the native tab redraw,
> (d) confirm header title child index. Gated OFF so it can't break a vanilla clog meanwhile.

Hooks (confirmed against evansloan):
- `@Subscribe onScriptPostFired` where `getScriptId() == ScriptID.COLLECTION_DRAW_LIST`
  → entry point to (re)draw our content when the clog list redraws.
- Detect open/close via `WidgetLoaded`/`WidgetClosed` on `InterfaceID.COLLECTION_LOG`
  (and handle the Adventure-Log path `InterfaceID.ADVENTURE_LOG`).
- Components: `ComponentID.COLLECTION_LOG_CONTAINER`,
  `COLLECTION_LOG_TABS` (category tabs), `COLLECTION_LOG_ENTRY_HEADER` (title/counts),
  `COLLECTION_LOG_ENTRY_ITEMS` (item grid).
- Native tab/page state: varbits `6905` (active tab) / `6906` (active page) — read-only
  reference; **our** tab is tracked in our own `bingoTabActive` flag (CS2 doesn't know
  our tab).

Steps:
1. On clog open, `createChild()` a new tab entry in `COLLECTION_LOG_TABS` labelled
   "Bingo" (matching native tab sprite/size); store its index.
2. Add a click listener on our tab: set `bingoTabActive = true`, **suppress** the native
   redraw for our slot, and call `renderBingoPage()`. Clicking any *native* tab sets
   `bingoTabActive = false` (let native CS2 run normally).
3. `renderBingoPage()`:
   - Header: set `COLLECTION_LOG_ENTRY_HEADER` title → "Bingo — {event.name}" + counts
     "{done}/{total}" recolored.
   - Items: clear our injected children in `COLLECTION_LOG_ENTRY_ITEMS`, then per
     `ClogTaskModel` row `createChild()` an item widget: `setItemId(itemId)` +
     `setItemQuantity(current)` + `setOpacity` (dim if not started), tooltip
     `label (current/goal)`, name recolored green (done) / red (not) / amber (partial).
4. Keep injection idempotent: rebuild only our children, never touch native ones, so
   leaving the tab restores the vanilla clog cleanly.

### Phase 3 — Real clog banner replica  🟡 BUILT (compiles; sound/sprite need live confirm)
> Done: `BingoClogBannerOverlay` — replica of the top-screen Leagues/clog **toast** (slide-in,
> hold, fade; dark gold-bordered banner; real item icon via `ItemManager.getImage`, or the
> clog-book sprite `SpriteID.HISCORE_COLLECTIONS_LOGGED` for stat tiles; gold title +
> task/progress). Same `show(label,current,required)` API + an itemId overload. Routed via
> `showBingoToast()` behind `config.useClogBanner()` (default **ON**); both trigger sites
> switched. `clogBannerSound` toggle (default off) — exact unlock jingle id is `TODO(live)`
> (placeholder `UI_BOOP`); raw clog-banner sprite isn't a named constant in 1.12.24, so this
> is a faithful drawn replica rather than the raw game sprite.

- New `BingoClogBannerOverlay`:
  - Use `SpriteManager.getSpriteAsync()` for the collection-log banner background +
    "Collection log" title sprite, and the unlocked item's icon
    (`ItemManager.getImage`).
  - **TODO at build:** confirm the exact banner sprite IDs (the green-bordered parchment
    + title). Source: `net.runelite.api.SpriteID` constants / cache dump. Until then the
    overlay falls back to a drawn approximation styled to match (current overlay's
    palette already close: `BG 62,53,41`, gold/green text).
  - Play the unlock jingle via `client.playSoundEffect(SoundEffectID...)` (confirm the
    clog-unlock sfx id) — gated behind a `clogBannerSound` config toggle.
  - API stays `.show(label, current, required)` so existing call sites in the plugin are
    unchanged; swap which overlay is registered in `startUp()` behind a
    `useClogBanner` config toggle for safe rollout.

### Phase 4 — Leagues-style in-clog filters  🟡 BUILT (compiles; needs live tuning w/ Phase 2)
> Done: folded into `ClogTabController` (single owner of clog-widget logic). Clickable
> **Status** (All/Completed/In-progress/Not-started) and **Type** (All/Drops/Stats) toggles
> that cycle on click and re-render via the pure `ClogTaskModel.filter`. Search control is
> `TODO(live)` (needs `ChatboxPanelManager`). Renders/works only when the injected Bingo tab
> does, so it inherits Phase 2's live-tuning dependency.

- `ClogFilterBar` injects a control strip near the header inside `COLLECTION_LOG_*`:
  - **Status:** All / Completed / In-progress / Not started.
  - **Type:** Drops / Stats / Both.
  - **Search:** optional — a clickable "Search" widget opening the game's chatbox input
    (`chatboxPanelManager`/`ChatboxTextInput`) and filtering by label substring.
  - Optional **★ favourite** per row (reldo-style), persisted in plugin config keyed by
    `tileId`.
- Each control is a `createChild()` text/sprite widget with `setHasListener(true)` +
  `setOnOpListener((JavaScriptCallback) e -> { setFilter(...); renderBingoPage(); })`
  and highlight the active option.
- Filtering is pure (`ClogTaskModel.applyFilters()`), so re-render is cheap.

---

## 6. Hard parts & risk mitigation

- **Custom-tab click vs native CS2.** The native clog redraws on tab change and will
  fight our injected tab. Mitigation: own a `bingoTabActive` flag; on
  `COLLECTION_DRAW_LIST` post-fire, if active, re-apply our page *after* the native draw
  (post-fired = end of script) and skip native content swap for our slot. Never mutate
  native children — only add/remove our own → clean restore.
- **Game updates** shuffling script/widget/varbit IDs. Mitigation: centralize every ID
  in one `ClogIds` constants block; guard every widget lookup with null checks and
  no-op + debug-log on miss (never NPE the clog). Add an integration smoke note to the
  release checklist.
- **Sprite/sfx IDs unknown.** Mitigation: feature-flag the banner; ship drawn
  approximation first, swap to true sprites once IDs confirmed.
- **Members with no panel** losing access to schedule/weekly. See §7-A decision.

---

## 7. Open decisions

- **A. Member schedule / weekly enrollment home.** ✅ DECIDED: fold a "Schedule"
  subsection into the clog Bingo tab; weekly auto-enroll stays on by default; expose
  manual enroll via `::bingo enroll` chat command. (Phase 2 work.)
- **B. Banner rollout.** Replace the old overlay outright, or keep both behind
  `useClogBanner` toggle for a release? Default: **toggle, defaults to new banner.**
- **C. Filters set.** Confirm the status/type/search set above is what you want, or add
  per-team / per-source filters.
- **D. Favourites.** Include ★ favourite + "favourites first" sort? (small extra.)

---

## 8. File-by-file change map

| File | Change |
|---|---|
| `OsrsBingoPlugin.java` | `updateNavVisibility()`; gate nav in `startUp`/`onConfigChanged`; register `ClogTabController`; swap banner overlay; wire `ScriptPostFired`/`WidgetLoaded`. |
| `OsrsBingoPanel.java` | Strip member sections (Event/Stat Tiles/Tracked Drops/Pending) — keep admin link + clan sync + (admin) schedule mgmt. |
| `OsrsBingoConfig.java` | New toggles: `useClogBanner`, `clogBannerSound`, optional `bingoTabFavourites` (hidden persisted JSON). |
| `ClogTabController.java` (new) | Interface injection, tab state, render, click handling. |
| `ClogTaskModel.java` (new) | Drops+stats → `TaskRow`; filter/sort. |
| `ClogFilterBar.java` (new) | Filter widgets + state. |
| `BingoClogBannerOverlay.java` (new) | Sprite banner replica (+ drawn fallback). |
| `BingoDropNotificationOverlay.java` | Kept as fallback while `useClogBanner=false`. |
| `OsrsBingoPluginTest.java` | Unit tests for `ClogTaskModel` filter/sort (pure, easy to test). |

---

## 9. Testing
- Unit: `ClogTaskModel` filtering/sorting/edge cases (no event, all done, empty).
- Manual in-client: open clog → Bingo tab renders; switch native tabs ↔ Bingo cleanly;
  filters update; complete a tile → banner fires with sound; non-admin sees no sidebar;
  admin sees sidebar; relog / world-hop; clog via Adventure Log path.
- Regression: vanilla clog untouched when Bingo tab never selected.

---

## 10. Suggested commit sequence
1. `feat(plugin): admin-only sidebar gating` (Phase 1)
2. `feat(plugin): inject Bingo tab into collection log` (Phase 2)
3. `feat(plugin): collection-log unlock banner replica` (Phase 3)
4. `feat(plugin): leagues-style in-clog task filters` (Phase 4)
