# Tile Authoring Spec (bulk CSV import)

The single source of truth for generating bingo tiles ("tasks") in bulk. Written so a
human **or an LLM** can produce a valid tile CSV that imports cleanly. Mirrors the parser
in `src/lib/csvTiles.ts` and the import API in
`src/app/api/events/[eventId]/tiles/import/route.ts` — if those change, update this doc.

> **TL;DR for generating hundreds of tasks:** make a Leagues-style event (dynamic board),
> then upload a CSV with one row per tile. Each row is a tile; row order = tile order.
> Use **item names** for drops (resolved to IDs on import), **pipe-separated** NPC names
> for kills, and `trackedStat`/`statType`/`statGoal` (not the `type` column) for skill/boss
> goals.

---

## 1. How import works (read this first)

- **Upload path:** Admin → an event's **Tiles** tab → *Upload CSV / Excel* (or `POST
  /api/events/{eventId}/tiles/import` with `{ rows: [...] }`, or multipart with `file` =
  the downloaded .xlsx workbook — only its **Tiles** sheet is read). The Tiles tab also has
  *Download spreadsheet* (.xlsx workbook with dropdowns/item list/instructions) and
  *Template CSV* buttons that export the current board in this exact format.
- **The round trip is 1:1.** Downloading the spreadsheet and uploading it unchanged is a
  no-op: rows that exactly match a tile's config are skipped (reported as `unchanged`,
  no `updatedAt` stamp), nothing is added and nothing is lost.
- **Rows map to tiles by position.** Row 1 → tile 1, row 2 → tile 2, … Existing tiles at
  that position are **updated**; fields you don't include are left untouched.
- **Growing the board:** extra rows beyond the current tile count **create new tiles**
  only on **dynamic boards** (Leagues bingo / Tile race) and only **before the event
  starts**, up to **1000 tiles**. A classic N×N grid is a fixed shape, so extra rows are
  **ignored** there.
- **The event must already have tiles** to import into (creating an event always seeds
  placeholder tiles, so this is automatic).
- **Pre-start lock:** `label`, `type`, `requiredAmount`, and item config are only applied
  **before the event starts**. `description`, `points`, `category`, `optional`, and the
  stat fields can be edited any time.
- **All-or-nothing:** every row is validated first; if any row is invalid (or any item
  name doesn't resolve), the whole import fails with a specific error and nothing changes.

**To create hundreds of tiles:** create a **Leagues bingo** event (set its tile count to
roughly what you want, or any number — the importer grows it), then upload a CSV with one
row per task. The board auto-resizes to the row count.

---

## 2. Columns

Header is **case-insensitive**, column **order is free**, unknown columns are **ignored**.
A blank `label` auto-fills as `Tile N`.

| Column | Meaning | Notes |
|---|---|---|
| `label` | Tile name shown on the board | Required for a meaningful tile; ≤200 chars |
| `description` | Free text shown on the tile | Optional |
| `type` | `standard` \| `drop` \| `kill` \| `gain` \| `timed` \| `deathless` \| `lms` \| `value` | **Skill/boss tiles leave this `standard`** and use the stat columns instead |
| `points` | Integer score weight (Leagues scoring) | ≥ 0, default 1 |
| `category` | Grouping tag(s) for the plugin/UI — comma-separated for several (e.g. `"Inferno, PvM"`, quoted) | ≤120 chars |
| `optional` | `true`/`false` (also `1`/`0`/`yes`/`y`) — doesn't count toward the total | |
| `requiredAmount` | Integer — **drop** (items needed) or **kill** (kills needed) | ≥ 1; leave blank for other kinds |
| `trackedStat` | Skill or boss **key** (e.g. `mining`, `zulrah`) | See §4 for valid keys |
| `statType` | `skill` \| `boss` | Required when `trackedStat` is set |
| `statGoal` | Integer XP (skill) or KC (boss) goal | ≥ 0 |
| `targetNpcs` | **Kill** tiles — NPC name(s), **pipe-separated** | e.g. `Cow\|Cow calf`; up to 25, ≤40 chars each |
| `timedActivity` | **Timed** tiles — activity to time (e.g. `Inferno`) | ≤60 chars |
| `timeThresholdSeconds` | **Timed** tiles — time cap in seconds; **LMS** tiles — placement cap (1 = win, 3 = top-3); **Deathless** tiles — exact party size (blank = any); **Drop** tiles — exact raid party size for the drop to count (blank = any) | 1–86400 (e.g. 1800 = 30:00) |
| `items` | **Drop** tiles — tracked item(s) | See §3 for the mini-format |

---

## 3. The `items` cell (drop & collection tiles)

Semicolon-separated entries: `Item:count; Item2:count2`. The `:count` suffix is optional
(defaults to 1). Each entry's item part can be:

- a **name** — `Bandos chestplate` → resolved to an item ID on import (covers
  untradeables/pets too). Must match the **exact in-game spelling**.
- a **raw id** — `12651` → used verbatim, no label.
- **`Name#id`** — `Pet zilyana#12651` → pins an exact id with a readable label. Use this
  when a name is ambiguous or you already know the id.

**Raid party-size gate (optional):** put an exact party size in `timeThresholdSeconds` and the
drop only counts when the raid team had exactly that many players — e.g. a solo Cursed phalanx
tile is items `Cursed phalanx` + `timeThresholdSeconds=1`. Blank = any size.

**Simple drop pool vs collection** (the distinction is driven by `requiredAmount`):

- **With `requiredAmount` set** → a *pool*: any of the listed items counts toward the
  total. e.g. items `Dragon warhammer; Dragon hunter lance` + `requiredAmount=3` = "get any
  3 of these".
- **Without `requiredAmount`** → a *collection log*: each item needs its own count and the
  tile completes when all are met. e.g. items `Bandos chestplate:1; Bandos tassets:1` = "get
  one of each".

> If an item name can't be resolved, the import fails listing the bad names. Fix the
> spelling or pin it with `Name#id`. (When the dev server is running, admins/Claude can look
> ids up via `GET /api/admin/items-search?q=`.)

---

## 4. Tile kinds & their required fields

A tile is **exactly one kind** — don't mix fields from different kinds (the API rejects it).

### Standard (manual)
Manually approved, no auto-tracking. `type=standard` (or blank). Only `label` needed.
```
"Get a firecape screenshot",,standard,5,Misc,false,,,,,,,,
```

### Skill goal (hiscores XP)
`type` stays `standard`. Set `trackedStat` (skill key), `statType=skill`, `statGoal` (XP).
Leave `requiredAmount` blank.
```
"10M Mining XP",,standard,10,Skilling,false,,mining,skill,10000000,,,,
```
**Valid skill keys:** `overall, attack, defence, strength, hitpoints, ranged, prayer, magic,
cooking, woodcutting, fletching, fishing, firemaking, crafting, smithing, mining, herblore,
agility, thieving, slayer, farming, runecraft, hunter, construction, sailing`

### Boss goal (hiscores KC)
`type` stays `standard`. Set `trackedStat` (boss key), `statType=boss`, `statGoal` (KC).
```
"50 Zulrah KC",,standard,8,Zulrah,false,,zulrah,boss,50,,,,
```
**Valid boss keys** (from `src/lib/constants.ts` `BOSSES`):
`abyssalSire, alchemicalHydra, amoxliatl, araxxor, artio, barrows, bryophyta, callisto,
calvarion, cerberus, chambersOfXeric, chambersOfXericChallengeMode, chaosElemental,
chaosFanatic, commanderZilyana, corporealBeast, crazyArchaeologist, dagannothPrime,
dagannothRex, dagannothSupreme, derangedArchaeologist, dukeSucellus, generalGraardor,
giantMole, grotesqueGuardians, hespori, kalphiteQueen, kingBlackDragon, kraken, kreeArra,
krilTsutsaroth, lunarChests, mimic, nex, nightmare, phosanisNightmare, obor, phantomMuspah,
sarachnis, scorpia, scurrius, skotizo, solHeredit, spindel, tempoross, gauntlet,
corruptedGauntlet, hueycoatl, leviathan, whisperer, theatreOfBlood, theatreOfBloodHardMode,
thermonuclearSmokeDevil, tombsOfAmascut, tombsOfAmascutExpertMode, tzKalZuk, tzTokJad,
vardorvis, venenatis, vetion, vorkath, wintertodt, zalcano, zulrah, doomOfMokhaiotl,
royalTitans, yama`

### Drop / collection
`type=drop`. Put items in the `items` cell. See §3 for pool vs collection.
```
"Any Bandos unique",,drop,15,GWD,false,3,,,,,,,"Bandos chestplate; Bandos tassets; Bandos boots; Bandos hilt"
"Full Bandos set",,drop,25,GWD,false,,,,,,,,"Bandos chestplate:1; Bandos tassets:1; Bandos boots:1"
```

### Kill (NPC count — even non-hiscores mobs)
`type=kill`. Set `targetNpcs` (pipe-separated names) and `requiredAmount` (kill count).
```
"Kill 100 cows",,kill,3,Skilling,false,100,,,,"Cow|Cow calf",,,
```

### Timed (clear under a time cap)
`type=timed`. Set `timedActivity` and `timeThresholdSeconds`.
```
"Sub-30 Inferno",,timed,50,Inferno,false,,,,,,Inferno,1800,
```

### Item gain (catch / cook / gather)
`type=gain`. The `items` column lists the item pool (semicolon-separated, like drop tiles);
`requiredAmount` = how many must be gained in total. The plugin counts the items appearing in the
inventory (bank/GE/trade gains ignored) and bakes the running total onto a screenshot.
```
"Catch 100 karambwan",,gain,20,Skilling,false,100,,,,,,,"Raw karambwan"
```

### Deathless raid (zero party deaths)
`type=deathless`. The raid rides `timedActivity` (all modes work: `Chambers of Xeric`,
`Chambers of Xeric: Challenge Mode`, `Theatre of Blood`, `Theatre of Blood: Hard Mode`,
`Tombs of Amascut`, `Tombs of Amascut: Expert Mode`); `requiredAmount` = deathless runs needed.
An optional exact party size rides `timeThresholdSeconds` (blank = any size). The plugin counts
every player death inside the raid instance and credits a run off the completion message only
when the count is zero. Entry Mode clears never credit a base-raid tile; harder modes do.
```
"Deathless ToB",,deathless,60,Raids,false,1,,,,,Theatre of Blood,,
"Deathless 5-man ToB",,deathless,80,Raids,false,1,,,,,Theatre of Blood,5,
```

### Diary (achievement-diary completions during the event)
`type=diary`. Reuses the `targetNpcs` column for `<Area> <Tier>` selectors — `Any` is a wildcard on
either side (`Any Elite`, `Wilderness Any`); `requiredAmount` = completions needed. The plugin credits
off the in-game completion message, which only fires the moment a tier is finished — tiers completed
before the event can't re-trigger it.
```
"Complete any elite diary",,diary,25,Diaries,false,1,,,,"Any Elite",,,
```

---

## 5. Header row (copy/paste)

```
label,description,type,points,category,optional,requiredAmount,trackedStat,statType,statGoal,targetNpcs,timedActivity,timeThresholdSeconds,items
```

See `docs/examples/tiles-example.csv` for a complete file covering every kind.

---

## 6. Gotchas

- **Skill/boss tiles are NOT `type=skill`/`type=boss`.** `type` only accepts
  `standard|drop|kill|timed`. Skill/boss is expressed via `trackedStat`+`statType`+`statGoal`
  on a `standard` row.
- **`items` uses semicolons**, not commas (comma is the CSV delimiter). **`targetNpcs` uses
  pipes** (`|`).
- **Don't set `requiredAmount` on stat/standard/timed tiles** — it only belongs on drop/kill.
- **Quote any cell containing a comma** (e.g. a description) per normal CSV rules; `""`
  escapes a literal quote.
- **Classic N×N grids won't grow** — only Leagues/Tile-race boards create tiles beyond the
  current count. Generate hundreds of tiles into a **Leagues** event.
- **Item names must match in-game spelling exactly** or the import fails (with the offending
  names listed). Pin with `Name#id` when unsure.
