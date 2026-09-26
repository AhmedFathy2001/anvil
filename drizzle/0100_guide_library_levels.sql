-- The starter library guides, rewritten for levels: one guide covers Beginner, Intermediate and
-- Advanced (lib/guideTiers), and the Vorkath and Barrows guides gain a gear progression the site's
-- calculator runs against. Library guides now need every level to be published, so without this
-- the seeds could not be edited at all.
--
-- ONLY UNTOUCHED SEEDS (version 1) are rewritten: a library editor's own version always wins. Clan
-- copies that still follow a rewritten guide move with it, exactly as a library save would move them;
-- their Discord posts catch up on the next "Update now" or edit.
WITH lib AS (
  UPDATE "guides" SET "body" = 'The Barrows are six crypts in Morytania. Each holds a brother; one crypt hides the tunnel to the **chest**. Kill all six, loot the chest, and every brother you killed adds to the reward.

## The brothers
- **Ahrim** (mage) — *Protect from Magic*, hit him with ranged or melee
- **Dharok** (melee) — *Protect from Melee*. His hits grow as **his** HP drops, so finish him fast
- **Guthan** (melee) — *Protect from Melee*; he heals from his hits
- **Karil** (ranged) — *Protect from Missiles*
- **Torag** (melee) — *Protect from Melee*
- **Verac** (melee) — *Protect from Melee*; some of his hits go through prayer, keep your HP up

## Finding the tunnel
One sarcophagus asks **"You find a hidden tunnel, do you want to enter?"** — that brother is in the tunnels. Kill the other five first, then enter. Doors in the tunnels ask a simple pattern puzzle.
||The chest room is always in the centre.||

::: beginner
## Your first runs
-# Around 60–70 Magic, Priest in Peril done, a spade.
- **Iban''s staff** with *Iban Blast* is the classic budget weapon — most brothers are weak to magic
- Wear mystic or any robes with a magic bonus; bring a ranged or melee weapon for Ahrim
- Bring **prayer potions**, some food and a Barrows teleport
- Go one brother at a time and don''t rush the tunnels — the monsters in there drain prayer

::: intermediate
## Faster runs
-# Around 75–85 Magic.
- The **Trident of the Seas** is a big step up: faster, and it needs no runes beyond its charges
- Ahrim''s robes and an **occult necklace** raise your damage on every brother
- Kill the tunnel monsters as you pass — a higher kill count improves the common loot rolls
- Aim for one inventory of prayer potions per few chests

::: advanced
## Speed runs
-# 90+ Magic, the best mage gear you own.
- A **Sanguinesti staff** heals you as you hit, so you can stay out for dozens of chests
- **Ancestral** robes and **Augury** kill most brothers in a few hits
- Plan a loop of the mounds that ends at the one with the tunnel, so you never walk back across the hill
- Rare rewards are still rare — the fastest route is the one you can repeat for hours

:::
```gear
{"monster":"Dharok the Wretched","setups":[{"tier":"beginner","name":"Iban Blast","style":3,"spell":"Iban Blast","stats":{"attack":70,"strength":70,"ranged":70,"magic":70},"prayer":"mystic_might","gear":{"weapon":12658,"head":4089,"body":4091,"legs":4093,"hands":4095,"feet":4097,"neck":1727}},{"tier":"intermediate","name":"Trident of the Seas","style":0,"stats":{"attack":85,"strength":85,"ranged":85,"magic":85},"prayer":"mystic_might","boost":"magic","gear":{"weapon":11905,"head":4708,"body":4712,"legs":4714,"hands":7462,"feet":4097,"neck":12002,"shield":6889,"cape":21791,"ring":25258}},{"tier":"advanced","name":"Sanguinesti staff","style":0,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"augury","boost":"saturated_heart","gear":{"weapon":22323,"head":21018,"body":21021,"legs":21024,"hands":19544,"feet":13235,"neck":12002,"shield":27251,"cape":21791,"ring":28313}}]}
```
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'barrows-beginners' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = 'Chambers of Xeric (CoX) is a team raid under Mount Quidamortem. Rooms are random each raid, ending with **the Great Olm**. Most supplies are made **inside** the raid, so bring less than you think.

## How a raid runs
1. **Start**: the leader makes a party at the entrance board; everyone joins before entering
2. **Rooms**: each floor has combat rooms, puzzle rooms and a resource room
3. **Olm**: three phases — head, hands and the final head phase
4. **Loot**: everyone''s points go into the drop roll; a purple light is a unique

## Combat rooms, the short version
- **Tekton**: heavy melee — step away while it is at its anvil
- **Vasa Nistirio**: it heals from the glowing crystal — break the crystal, then hit Vasa
- **Vanguards**: damage all three evenly or they reset
- **Muttadiles**: the small one heals at the meat tree — keep it busy
- **Shamans**: move off the purple spit and away from their jumps
- **Mystics**: *Protect from Magic*, kill them with melee or ranged

::: beginner
## Your first raids
-# Base 75+ combat, 70+ Prayer. Say "learner" when you join.
- Join **learner** or mass raids — people expect questions there
- Bring your best melee, ranged and magic switches, an axe and a pickaxe
- Don''t take all the potions from the herb room; overloads and brews are shared
- At Olm: ask your team which hand you are on, and move off marked tiles

::: intermediate
## Small teams
-# Base 85+, Piety/Rigour/Augury unlocked.
- Three- to five-player teams: you''ll handle rooms on your own, so learn each one''s safe tiles
- Scout for a good layout before you start if your team prefers it
- Learn Olm''s crystal bombs and acid trail: most wipes happen there
- Take the resource room seriously — enough overloads decides how Olm goes

::: advanced
## Speed and challenge mode
-# 99s, best-in-slot switches, a practised team.
- **Challenge mode** (CM) has a timer and better loot odds — it expects every room to be clean
- Solo raids are possible with the right gear; learn the prep routes before trying
- Roles matter: agree who handles which Olm hand and who preps the potions

:::
## Etiquette
- Stay until the end; leaving mid-raid hurts your team''s points
- Ask before splitting from the group
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'chambers-of-xeric-learner' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = 'Clues come in six tiers: **Beginner → Easy → Medium → Hard → Elite → Master**. Each has more steps and better rewards. Most come from monster drops; some from skilling.

## Step types
- **Anagram / cryptic**: talk to the NPC the puzzle names
- **Coordinates**: dig where the numbers point — you need a **sextant, watch and chart**
- **Emote**: go to the spot, wear the items, perform the emote
- **Maps**: find the place drawn on the map
- **Puzzle box / light box**: solve the puzzle in the step

The **Clue Scroll** plugin in RuneLite shows where to go for most steps.

::: beginner
## Beginner and easy clues
- Beginner clues drop from most low-level monsters — a gentle start
- Carry a **spade** and a few teleports
- Easy clues pay little but teach the step types

::: intermediate
## Medium and hard clues
- Build and fill **STASH units** (Construction) near emote spots so you never carry emote gear
- More teleports = faster clues: jewellery, a spirit tree or fairy ring access help a lot
- Hard clues are where the first valuable rewards show up

::: advanced
## Elite and master clues
- You can hold one clue of each tier at a time — finish it before the next drop of that tier
- **Master clues** come from Watson in Hosidius, for one clue of each lower tier (easy to elite)
- Elite steps may need high levels and quest progress; check the step before you travel

:::
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'clue-scrolls-basics' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = 'Early on, **skilling money** is steady and safe. **Combat money** grows fast once you have a few key items. Buying supplies is often faster than gathering them yourself — your time is worth money.
-# Prices change. Check the Grand Exchange before you commit to a method.

::: beginner
## From zero
- **Collecting**: cowhides from cows, feathers from chickens
- **Tanning hides** in Al Kharid: buy cowhides, tan them, sell the leather
- **Picking flax** and spinning bowstrings (Crafting 10)
- **Hill giants** (combat around 40): big bones and limpwurt roots

::: intermediate
## A few levels in
- **Wine of Zamorak** with Telekinetic Grab (Magic 33)
- **Blast Furnace** once your Smithing allows — profitable XP
- **Slayer** from mid-levels: aberrant spectres, gargoyles and nechryael pay well
- **Barrows**: rune items, and a chance at armour pieces

::: advanced
## Bossing
- **Vorkath** after Dragon Slayer II: steady, predictable profit
- **Zulrah** and the **Gauntlet** once your gear and mechanics are there
- **Raids** (ToA, CoX) for the biggest items
- Put profit into items that raise your earning speed first

:::
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'early-money-making' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = 'The Tombs of Amascut (ToA) let you set your own difficulty with **invocations** (the raid level). It is the most beginner-friendly raid: start easy and turn it up as rooms become comfortable.

**Getting in**: after *Beneath Cursed Sands*, head to the Necropolis in the Kharidian Desert. **Supplies come from the raid**: the supply cache between paths gives nectar and restoring drinks.

## The four paths
Each path has a puzzle room then a boss, in any order you choose.
- **Het — Akkha**: redirect the light with the mirror; switch prayers against Akkha''s styles
- **Crondis — Zebak**: water the palm; switch between Protect from Missiles and Magic
- **Apmeken — Ba-Ba**: fix the right problems; dodge the boulders and rolling balls
- **Scabaras — Kephri**: match the tiles; kill the scarab swarms before they heal her

## The Wardens
Three phases: attack the obelisk, then the wardens (hit the core when exposed), then dodge the floor lightning while you finish them.

::: beginner
## Entry and low levels
-# Around 75–85 combat stats.
- **Entry mode** (level 0) has no uniques but is perfect for learning every room
- Move up to around **150** once each room feels calm — uniques start to be realistic there
- Add one invocation at a time; a clean run teaches more than a wipe

::: intermediate
## Normal raids, 150–300
-# 90+ combat, a blowpipe or better and a strong melee weapon.
- Invocations that add damage or remove supplies are where the loot scales — pick the ones you can handle
- Practise **prayer switching** on Akkha and Zebak until it is automatic
- Groups of two to four make each path faster and more forgiving

::: advanced
## Expert, 300+
-# Maxed combat, the best gear you have, and fast prayer switching.
- **Expert** mode brings harder mechanics and much better unique odds
- Shadow (Tumeken''s shadow), fang and a strong ranged weapon cover almost every room
- Plan invocations around your weakest room, not your best one

:::
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'tombs-of-amascut-entry' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = '## Requirements
- **Dragon Slayer II** completed
-# Once you know the two specials, the fight never changes. That is what makes it good money.

## The fight
Vorkath attacks with ranged, magic and dragonfire. Keep an **antifire** and **anti-venom** up, wear an anti-dragon shield or dragonfire ward, and use your ranged boosting prayer with a protection prayer.

Every **seventh attack** is a special, alternating between:

**Acid phase** — the floor fills with acid and he fires a rapid stream. **Walk back and forth in a straight line** on clean tiles and never stand still.

**Zombified spawn** — you are **frozen** and a small spawn crawls toward you. Cast **Crumble Undead** on it before it reaches you, or it explodes.

## Watch for
- One dragonfire attack **turns your prayers off** — put them straight back on
- A **fireball** fired high lands where you stood: take two steps

::: beginner
## Learning kills
-# Around 80 Ranged, 70 Defence, Eagle Eye.
- A **rune crossbow** with **ruby dragon bolts (e)** works — slow kills, but safe to learn on
- Bring plenty of food: your first trips are about learning the acid walk, not speed
- Crumble Undead runes on every trip

::: intermediate
## Steady profit
-# Around 90 Ranged, Rigour or Eagle Eye.
- The **Armadyl crossbow** and Karil''s or crystal armour cut kill times a lot
- Swap to **diamond dragon bolts (e)** while he''s at high HP, ruby bolts when he''s low — or just use rubies
- Four to six kills per trip is a good target

::: advanced
## Fast kills
-# 99 Ranged, Rigour.
- The **dragon hunter crossbow** is the weapon for this fight: it is built for dragons
- A **salve amulet (ei)** also works on Vorkath — he is undead
- Masori armour, zaryte vambraces and an assembler round it out
- With the specials down to muscle memory, kills well under two minutes are normal

:::
## Loot
Every kill drops **superior dragon bones** and **blue dragonhide**. Uniques: the **draconic** and **skeletal visage**, the **dragonbone necklace**, the **jar of decay** and **Vorki** the pet. His head is guaranteed at 50 kills.

```gear
{"monster":"Vorkath#Post-quest","setups":[{"tier":"beginner","name":"Rune crossbow","style":1,"stats":{"attack":70,"strength":70,"ranged":80,"magic":70},"prayer":"eagle_eye","boost":"ranging","gear":{"weapon":9185,"ammo":21944,"head":1169,"body":2503,"legs":2497,"hands":2491,"feet":6328,"shield":1540,"cape":10499,"neck":1706}},{"tier":"intermediate","name":"Armadyl crossbow","style":1,"stats":{"attack":85,"strength":85,"ranged":90,"magic":85},"prayer":"eagle_eye","boost":"ranging","gear":{"weapon":11785,"ammo":21944,"head":4732,"body":4736,"legs":4738,"hands":7462,"feet":6328,"shield":22002,"cape":10499,"neck":19547,"ring":25260}},{"tier":"advanced","name":"Dragon hunter crossbow","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"rigour","boost":"ranging","gear":{"weapon":21012,"ammo":21944,"head":27235,"body":27238,"legs":27241,"hands":26235,"feet":13237,"shield":22002,"cape":22109,"neck":25278,"ring":28310}}]}
```
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'vorkath-guide' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = 'The Wintertodt is a group skilling boss that trains **Firemaking** and pays in supply crates. You need **50 Firemaking** to enter.

## How it works
1. Chop **bruma roots**
2. Optionally fletch them into **bruma kindling** (more points, slower)
3. Feed the **brazier**; relight it if it goes out, repair it if it breaks
4. When the Wintertodt''s energy hits 0, the round ends

You need **500 points** in a round for a supply crate. Bring an **axe**, **tinderbox**, **knife** and **hammer**, and wear as many **warm** items as you can.

::: beginner
## 50–70 Firemaking
-# Low HP means the cold hurts: keep food handy.
- Bring cheap food that heals a little at a time — cakes or jugs of wine
- Focus on staying alive and hitting 500 points; efficiency comes later
- Wear warm clothing (at least four pieces) to cut the damage you take

::: intermediate
## 70–85 Firemaking
-# Get the pyromancer outfit — bonus XP, and it counts as warm gear.
- Fletch roots into kindling while you wait for the brazier: more points per root
- Stand at a brazier with a tree next to it to cut walking
- Bank crates in batches — the herbs, seeds and ores add up for an early account

::: advanced
## 85–99 and the pet
-# Maximise points per round.
- Keep the brazier lit and repaired yourself; every relight is points
- Do many rounds back to back without banking between them
||The pet, Phoenix, can come from any supply crate.||

:::
', "version" = 2, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'wintertodt' AND "version" = 1
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Now covers every level, beginner to advanced',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v2)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
