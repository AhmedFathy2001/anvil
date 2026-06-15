# Anvil Hub — multi-section clog tab (build plan)

Status: **proposed** (awaiting review before implementation)
Goal: turn the in-clog **Anvil** tab into a member-facing hub that hosts *every* event type
as sub-sections — points bingo, classic (square) bingo, Boss/Skill of the Week leaderboards,
tile race, and the schedule — so members never need the side panel. The side panel stays
**admin-only** (already shipped in Phase 1 of the clog work).

Builds on the existing clog tab (`ClogTabController`, `ClogTaskModel`, `ClogIds`).

---

## Architecture

The clog is natively a **left list + right content** interface. We already hide the native
boss list and own that left column. The hub reuses that shape:

```
┌ Anvil tab (selected) ───────────────────────────────────┐
│ SECTIONS (left)      │  CONTENT (right: header + items)   │
│  ▸ Bingo             │   <renders the selected section>   │
│    Classic Bingo     │   task accordion / square grid /   │
│    Boss of the Week  │   leaderboard table / schedule     │
│    Skill of the Week │                                    │
│    Tile Race         │                                    │
│    Schedule          │                                    │
└──────────────────────────────────────────────────────────┘
```

- **Left column = section navigator** (replaces the filter-only column). Each row switches
  `currentSection`.
- **Right pane = the active section's view.** One small renderer per section, all writing into
  the existing `COLLECTION_LOG_ENTRY_HEADER` (banner) + `COLLECTION_LOG_ENTRY_ITEMS` (body),
  which we already drive.
- **Bingo filters** (Status/Type/Category) move *into* the Bingo view as a compact control
  strip at the top of the body, freeing the left column for navigation.
- **Sections are data-driven**: a section only appears if its data exists (Bingo if tasks
  exist, BOTW/SOTW if a weekly is active, Classic if a square board exists, Schedule always).

New plugin classes:
- `AnvilSection` (enum/list) + `currentSection` state in `ClogTabController`.
- `renderSectionNav()` (left column) + a dispatch `renderSection()` → `renderBingoView()` /
  `renderScheduleView()` / `renderLeaderboardView()` / `renderClassicGridView()`.
- `AnvilDataModel` helpers (pure) per view, mirroring `ClogTaskModel` (testable).

---

## What data already flows vs. what's new

| Section | Render | Data | Cost |
|---|---|---|---|
| Bingo (points) | task accordion (done) | `trackedDrops`/`trackedStats` in config | ✅ have it |
| Schedule | upcoming list | `config.schedule` (`bingos[]`, `weeklies[]`) | ✅ have it |
| Boss/Skill of Week | leaderboard table | `/api/plugin/weekly` + `active-weekly` exist; `computeLeaderboard()` in `lib/weekly.ts` | 🟡 extend endpoint to return entries |
| Classic Bingo grid | NxN squares | board tiles (position) + per-team completions | 🔴 new payload |
| Tile Race | grid + race standings | board + per-team progress + race rules | 🔴 new payload + event kind |
| Multiple events | each event = a section | config returns ONE event today | 🔴 contract change |

---

## Phases

### Phase 1 — Section-navigator framework  *(plugin only, no server change)*
- Add `currentSection` + an ordered, data-driven section list.
- `renderSectionNav()`: render the left column as a vertical clickable list (reuse the existing
  `filterControl` styling), highlighting the active section. Each row sets `currentSection` and
  re-renders.
- `renderSection()`: dispatch to the right-pane renderer for `currentSection`.
- Move the Status/Type/Category filters into `renderBingoView()` as a top control strip.
- Default `currentSection` = first available (Bingo if tasks, else Schedule).
- Acceptance: clicking sections swaps the right pane; Bingo view unchanged in behaviour.

### Phase 2 — Schedule + Bingo views  *(plugin only)*
- **Bingo view** = the current accordion + contextual filter strip.
- **Schedule view**: render `config.schedule.bingos` + `.weeklies` as rows
  (title · status badge · date range). Pure `AnvilScheduleModel` to shape + sort (upcoming
  first, active pinned). No server change.
- Acceptance: Schedule lists real upcoming events/comps from the existing payload.

### Phase 3 — Boss/Skill of the Week leaderboards  *(server + plugin)*
- **Server**: extend `/api/plugin/weekly` (or add `/api/plugin/weekly-leaderboard`) to return
  the active comp's standings: `{ id, title, type, metric, entries: [{rank, rsn, value}], me }`
  using `computeLeaderboard()`. Top ~25 + the caller's own row.
- **Java**: `WeeklyLeaderboard` DTO + `fetchWeeklyLeaderboard()`; cache briefly.
- **Plugin**: `renderLeaderboardView()` — header = comp title + metric + time left; body = a
  rank/name/value table (highlight the player's row). One section per active weekly (BOTW shows
  when `type=boss`, SOTW when `type=skill`).
- Acceptance: BOTW/SOTW sections show live standings.

### Phase 4 — Classic bingo grid + Tile Race  *(server + plugin)*
- **Event kind**: today we have `events.scoringMode` (`tiles`|`points`). Classic square bingo
  is `scoringMode=tiles`; **Tile Race** needs a new distinguishing field
  (`events.format` = `bingo`|`tilerace`, or reuse an existing flag — *decision needed*).
- **Server**: add board state to the plugin payload for these events: each tile's
  `position`, `label`, `icon/itemId`, and the team's completion bool (+ per-team for tile race).
- **Plugin**: `renderClassicGridView()` — render an NxN square grid in the item pane
  (we already know the 36×32 cell / 6-col geometry; classic boards are square so compute cols
  from board size), colour-coded completed/not. Tile Race adds a compact per-team standings
  strip above the grid.
- Acceptance: a 5×5 classic board renders as coloured squares; tile race shows standings.

### Phase 5 — Multiple concurrent events  *(server + plugin)*
- **Server**: config currently returns a single `event`/`team`/`player`. Add `events: [...]`
  — every event the player is enrolled in, each with its type + the data its view needs.
  Keep the single `event` for back-compat.
- **Plugin**: the section list expands to one entry per active event (named by event), each
  routed to the right renderer by its type. Weeklies + Schedule remain global sections.
- Acceptance: with two live events, both appear as sections and render independently.

---

## Open decisions
- **A. Tile Race identity**: new `events.format` column vs. deriving from existing fields?
  (Recommend a small `format` enum: `bingo` | `tilerace`.)
- **B. Section ordering / default**: fixed order (Bingo, Classic, BOTW, SOTW, Tile Race,
  Schedule) with the player's own active event pinned first?
- **C. Leaderboard size**: top 25 + self, or full list with scroll?
- **D. Where do member actions live** (e.g. weekly enroll)? Chat command `::anvil enroll`
  (decided earlier) vs. a clickable row in the Schedule/Weekly view.

---

## Risks / mitigations
- **Left-column widget lifecycle**: switching sections must cleanly rebuild the nav + body
  without stale children. Mitigation: a single `clearAnvilChildren()` (by name prefix) before
  each render, same pattern as the filter column today.
- **Payload growth**: classic boards + leaderboards enlarge the config. Mitigation: lazy
  per-section fetches (separate endpoints) rather than stuffing everything into `/config`.
- **Contract change (multi-event)**: additive (`events[]` alongside `event`) to avoid breaking
  the current plugin behaviour during rollout.
- **Game-update fragility** (shared with the clog work): all widget IDs already centralised in
  `ClogIds`.

---

## Suggested commit sequence
1. `feat(plugin): anvil section navigator framework`
2. `feat(plugin): schedule + bingo sections`
3. `feat(plugin,web): weekly leaderboard section`
4. `feat(plugin,web): classic bingo grid + tile race`
5. `feat(plugin,web): multiple concurrent events as sections`
