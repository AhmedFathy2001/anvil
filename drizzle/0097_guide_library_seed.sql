-- The Anvil guide library's starter set: a handful of in-game guides every clan sees on /guides
-- from day one and can copy, customise and post to Discord. Library guides (clan_id null) are
-- edited from /staff/guides after this; the migration never touches them again.
--
-- ON CONFLICT DO NOTHING: if a library guide with the same slug already exists it is left alone.
-- Each insert writes revision v1 alongside, so the history view has a starting point.
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'barrows-beginners', 'Barrows for beginners', 'Six brothers, one chest, and the best early source of armour and money. Gear, route and what to bring.', 'bossing', '## What it is
The Barrows are six crypts in Morytania. Each holds a brother you fight; one crypt hides the tunnel to the **chest**. Kill all six, loot the chest, and every brother you killed adds to your reward.
-# Worth doing from mid-level combat. It teaches prayer switching without punishing you hard for mistakes.

## Requirements
- **Priest in Peril** completed (to get into Morytania)
- A spade (to dig into each mound)
- ~70+ Magic and decent Ranged/Melee is comfortable; lower works with more food

---

## Gear
**Magic** is your main weapon — most brothers are weak to it:
- Best available staff/trident, **Iban''s staff** is a great budget pick
- Fire or earth spells are fine at lower levels

**Melee or Ranged** for Ahrim (the mage brother):
- Any decent crossbow or melee weapon works

Bring **prayer potions**, a few pieces of food, and a **Barrows teleport** or Morytania teleport for the next trip.

---

## The brothers
- **Ahrim** (mage) — use *Protect from Magic*, hit him with ranged/melee
- **Dharok** (melee) — *Protect from Melee* always. His hits grow as **his** HP drops, so finish him fast
- **Guthan** (melee) — *Protect from Melee*, he heals from his hits
- **Karil** (ranged) — *Protect from Missiles*
- **Torag** (melee) — *Protect from Melee*
- **Verac** (melee) — *Protect from Melee*; his hits can go through prayer, keep HP up

## Finding the tunnel
One brother''s sarcophagus says **"You find a hidden tunnel, do you want to enter?"** — that is your tunnel brother. Kill the other five first, then enter and fight the last one in the tunnels.
In the tunnels, doors ask a simple puzzle: pick the item that continues the pattern.
||The chest room is always in the centre.||

## Tips
- Keep **run energy** up — the tunnels are long
- Kill-count goes up per monster in the tunnels too; higher kill-count, better rolls on common loot
- Rare rewards are the brothers'' armour and weapons: keep going, it is a long grind
', 'published', 1, 10, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'chambers-of-xeric-learner', 'Chambers of Xeric — learner guide', 'Your first CoX raids: what to bring, how rooms work, and how not to be the one who wipes the team.', 'raids', '## Before you go
Chambers of Xeric (CoX) is a team raid under Mount Quidamortem. Rooms are random each raid, ending with **the Great Olm**.
-# Learner raids are for learning. Say so in your team chat and people will explain as you go.

**Rough requirements for learner teams**
- Base 75+ combat stats, 70+ Prayer (for Piety/Rigour/Augury is ideal, not required)
- 55+ Herblore helps (you''ll make potions inside)
- Farming, Woodcutting, Mining and Hunter levels help with the resource rooms

---

## What to bring
Most supplies are made **inside** the raid, so bring less than you think:
- Your best melee, ranged and magic switches
- An **axe** and a **pickaxe** for the resource rooms
- A few stamina potions and food for the first rooms
-# Dying inside the raid is safe, but it costs the team points — play it steady.

---

## How a raid runs
1. **Start**: the leader makes a party at the entrance board; everyone joins before entering
2. **Rooms**: each floor has combat rooms, puzzle rooms and a resource room
3. **Olm**: the final boss has three phases — head, hands and the final head phase
4. **Loot**: everyone''s points go into the drop roll; purple light = unique

## Combat rooms, the short version
- **Tekton**: heavy melee — step away while it is at its anvil, and use your spec weapon
- **Vasa Nistirio**: it heals from the glowing crystal — break the crystal, then hit Vasa
- **Vanguards**: damage all three evenly; if one gets too far ahead of the others they reset
- **Muttadiles**: the small one heals at the meat tree — keep it busy
- **Shamans**: move off the purple spit and away from their jumps
- **Mystics**: *Protect from Magic*, kill them with melee or ranged

## Olm tips
- Split onto the hands the way your team calls it — ask before the fight
- Watch for crystal bombs and falling crystals — move off marked tiles
- Acid pools: don''t stand in them; walk in a line to leave a clean trail
- A **clenched** hand can''t be hurt — switch to the other one

---

## Etiquette
- Say **"learner"** when you join, ask questions
- Don''t take all the potions — share the brews/overloads from the herb room
- Stay until the end; leaving mid-raid hurts your team''s points
', 'published', 1, 20, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'tombs-of-amascut-entry', 'Tombs of Amascut — getting started', 'ToA scales from entry mode to expert — the most beginner-friendly raid. Invocations, paths and what each boss wants from you.', 'raids', '## Why start here
The Tombs of Amascut (ToA) let you set your own difficulty with **invocations** (raid level). Entry mode has no unique drops but is perfect to learn the mechanics without pressure.
-# Solo is possible at low raid levels. A small group of friends is the best way to learn.

**Getting in**: after *Beneath Cursed Sands*, head to the Necropolis in the Kharidian Desert.

---

## Raid level (invocations)
- **Entry mode** (level 0): learn the rooms
- **Normal** ~150+: uniques start to roll with meaningful odds
- **Expert** 300+: harder mechanics, better loot
Tick invocations you understand; don''t jump to high levels until each room feels calm.

## What to bring
- A **blowpipe** or good ranged weapon, a strong melee weapon (fang is ideal)
- **Supplies come from the raid**: the supply cache between paths gives nectar (heals) and restoring drinks — bring little else

---

## The four paths
Each path has a puzzle room then a boss. You pick the order.

**Het — Akkha**
- Puzzle: redirect the light beam with the mirror to break the seal
- Boss: switch prayers against his melee/ranged/magic; kill the shadows and memory blocks quickly

**Crondis — Zebak**
- Puzzle: water the palm tree by filling containers
- Boss: switch between **Protect from Missiles** and **Magic** by the projectile, and use the jugs to break the blood waves

**Apmeken — Ba-Ba**
- Puzzle: fix the correct problems (vents, pillars, sickness)
- Boss: avoid falling boulders and rolling balls; kill boulders during the special phase

**Scabaras — Kephri**
- Puzzle: matching obelisks or sequence
- Boss: kill the scarab swarms before they reach her — they heal her

## The Wardens
Final fight in three phases. **P1**: attack the obelisk. **P2**: switch prayers as the warden attacks, and hit the core when it is exposed. **P3**: dodge the floor lightning and falling debris while you finish them.

---

## Tips
- **Learn one invocation at a time.** A wipe with tough invocations teaches less than a clean run
- Prayer switching is the skill ToA rewards most — practice on Akkha
', 'published', 1, 30, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'vorkath-guide', 'Vorkath — steady money for mid-game', 'The undead dragon at the end of Dragon Slayer II. Two specials to learn, then it''s the same fight every kill.', 'bossing', '## Requirements
- **Dragon Slayer II** completed
- Comfortable around 80+ Ranged and 70+ Defence, with **Eagle Eye** or **Rigour**
-# Once you know the two specials, the fight never changes. That is what makes it good money.

## Gear
- **Anti-dragon shield** or a dragonfire ward
- **Extended super antifire** (or extended antifire) and **anti-venom**
- Best ranged weapon: the **dragon hunter crossbow** with **ruby (e)** and **diamond (e)** dragon bolts is the usual pick
- Runes for **Crumble Undead** for the spawn — or any weapon that can hit it fast

---

## The fight
Vorkath attacks with ranged, magic and dragonfire. Keep antifire and anti-venom up, and use your ranged boosting prayer with a protection prayer.

Every **seventh attack** is a special, alternating between these two:

**Acid phase**
- The floor fills with acid and he fires a rapid stream at you
- **Walk back and forth in a straight line** on clean tiles; never stand still
- Fit in attacks when the line lets you

**Zombified spawn**
- You are **frozen** and a small spawn crawls toward you
- Cast **Crumble Undead** on it before it reaches you — it explodes if it does

## Watch for
- One dragonfire attack **turns your prayers off** — put them straight back on
- A **fireball** fired high into the air lands where you stood: take two steps
- Venom: re-dose anti-venom when it wears off

---

## Loot
Every kill drops **superior dragon bones** and **blue dragonhide**. Uniques: the **draconic** and **skeletal visage**, the **dragonbone necklace**, the **jar of decay**, and **Vorki** the pet. His head is guaranteed at 50 kills.
', 'published', 1, 40, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'wintertodt', 'Wintertodt — Firemaking from 50 to 99', 'Group skilling boss that trains Firemaking and pays out in supply crates. Great for new accounts.', 'skilling', '## Requirements
- **50 Firemaking** to enter
- **Warm clothing** reduces the damage the cold deals — wear as many warm items as you can (at least four), such as the pyromancer outfit or clue hunter gear
-# Pyromancer outfit is obtained from Wintertodt itself and gives bonus XP.

## What to bring
- An **axe**, a **tinderbox**, and a **knife** (for fletching roots into kindling)
- A **hammer** to fix braziers
- Food: cheap food that heals a little at a time — cakes or jugs of wine

---

## How it works
1. Chop **bruma roots** from the trees
2. Optionally fletch them into **bruma kindling** (more points, slower)
3. Feed roots/kindling into a **brazier**; relight it if it goes out, repair it if it breaks
4. When the Wintertodt''s energy hits 0, the round ends

You need **500 points** in a round to get a supply crate. More points means better loot.

## Tips
- **Stand at a brazier corner** with a nearby tree to save walking
- Keep HP above ~50% — the cold and snowfall hit harder at low levels
- Supply crates give **logs, herbs, ores and seeds** — a real boost for a fresh account
||The pet, Phoenix, can come from any supply crate.||
', 'published', 1, 50, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'early-money-making', 'Money making for new accounts', 'Low-requirement ways to fund your first real gear, from zero to a few million.', 'money', '## Principles
- Early on, **skilling money** is steady and safe
- **Combat money** grows fast once you have a few key items
- Buying supplies on the Grand Exchange is often faster than gathering them yourself — your time is worth money
-# Prices change. Check the Grand Exchange before you commit to a method.

---

## Zero requirements
- **Collecting items**: cowhides from cows, feathers from chickens
- **Tanning hides** in Al Kharid: buy cowhides, tan them to leather, sell
- **Picking flax** and spinning it into bowstrings (Crafting 10)

## A little skill
- **Hill giants** (combat around 40+): big bones and limpwurt roots
- **Blast furnace** (after Smithing levels): profitable XP
- **Wine of Zamorak** with Telekinetic Grab (Magic 33)

## Once you''re stronger
- **Barrows**: rune items and a chance at armour pieces
- **Vorkath** or **Zulrah** after quest and stat requirements
- **Slayer**: great money from mid-level onward (aberrant spectres, gargoyles, nechryael)

---

## Tips
- **Don''t gamble what you need** for the next upgrade
- Put gold into items that also help you earn more: a better weapon speeds up every method above
', 'published', 1, 60, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'clue-scrolls-basics', 'Clue scrolls — the basics', 'Beginner to master: how clues work, what to carry, and how to get more of them.', 'minigames', '## Tiers
**Beginner → Easy → Medium → Hard → Elite → Master**
Each tier has more steps and better rewards. Most clues come from monster drops; some from skilling (clue geodes, nests, bottles).

---

## What to carry
- A **spade**
- **Teleports**: the more you can teleport to, the faster clues go
- For emote clues: the **items the step asks for** — check before you leave the bank
- Build and fill **STASH units** (Construction) near emote spots so you never carry emote gear again

## Step types
- **Anagram / cryptic**: talk to the NPC named in the puzzle
- **Coordinates**: dig at the spot the numbers point to — you need a **sextant, watch and chart**
- **Emote**: go to the location, wear the items, perform the emote
- **Maps**: find the location drawn on the map
- **Puzzle box / light box**: solve the puzzle in the step

---

## Tips
- The **Clue Scroll** plugin in RuneLite highlights where to go for most steps
- You can only hold one clue of each tier — finish it before the next drop of that tier
- **Master clues** come from Watson in Hosidius, in exchange for one clue of each lower tier (easy to elite)
', 'published', 1, 70, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  VALUES (NULL, 'clan-event-rules-template', 'Clan event rules (template)', 'A ready-to-edit rules post for your bingo or competition. Copy it, fill in the blanks, post it to your events channel.', 'clan', '## Welcome to the event
-# Replace the words in **[brackets]** before posting.

**When**: [start date] to [end date]
**Teams**: [how teams are picked — draft, random, captains]
**Entry**: [free / fee in gp, who collects it]

---

## How to score
- Tiles are completed by **drops, kills or XP** gained **during** the event
- The Anvil plugin records drops automatically — keep it running and signed in
- **Screenshots**: if a drop is missing, post a screenshot in [channel] with the date visible

## What counts
- Only items that drop **to you** during the event
- Team members must be on the event roster **before** the drop
- Group content (raids, ToA) counts for [the player who got it / the whole team]

---

## Fair play
- **No boosting** from other players outside your team
- **No buying or trading** items to complete tiles
- Staff can reject anything that breaks the spirit of the event

## Questions
Ask in [channel] or ping **@[event staff role]**.
Good luck, and have fun! 🎉
', 'published', 1, 80, false,
    to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
  ON CONFLICT ON CONSTRAINT "guides_clan_slug_unique" DO NOTHING
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
