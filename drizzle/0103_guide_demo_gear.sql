-- Demonstration gear for the library: multi-target fights and inventories (lib/dps/encounter,
-- lib/runeliteExport). Barrows now has a setup per brother group — magic for the five melee/ranged
-- brothers, a ranged switch for Ahrim — and Vorkath carries what to bring. Two new guides show the
-- rest: Dagannoth Kings (one king per combat style) and Moons of Peril (one melee style per moon).
--
-- Only untouched seeds (version 2, as 0100 left them) are changed; an editor's version always wins.
-- New guides are skipped if a library guide with the slug already exists. Item ids were resolved
-- from names against src/data/gearItems.json and the wiki item mapping.
WITH lib AS (
  UPDATE "guides" SET "body" = regexp_replace("body", '```gear\n.*?\n```', '```gear
{"monster":"Ahrim the Blighted","monsters":["Ahrim the Blighted","Dharok the Wretched","Guthan the Infested","Karil the Tainted","Torag the Corrupted","Verac the Defiled"],"setups":[{"tier":"beginner","name":"Iban''s blast","style":3,"spell":"Iban Blast","stats":{"attack":70,"strength":70,"ranged":70,"magic":70},"prayer":"mystic_might","note":"Switch to the crossbow and range body for Ahrim.","targets":["Dharok the Wretched","Guthan the Infested","Karil the Tainted","Torag the Corrupted","Verac the Defiled"],"gear":{"weapon":12658,"head":4089,"body":4091,"legs":4093,"hands":4095,"feet":4097,"neck":1727,"cape":1052},"inventory":[{"id":9185},{"id":1169},{"id":2503},{"id":2497},{"id":952},{"id":19629},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":560,"q":300},{"id":554,"q":1500},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385}]},{"tier":"beginner","name":"Rune crossbow","style":1,"stats":{"attack":70,"strength":70,"ranged":70,"magic":70},"prayer":"eagle_eye","targets":["Ahrim the Blighted"],"gear":{"weapon":9185,"ammo":11875,"head":1169,"body":2503,"legs":2497,"hands":4095,"feet":4097,"neck":1727,"cape":1052}},{"tier":"intermediate","name":"Trident of the seas","style":0,"stats":{"attack":85,"strength":85,"ranged":85,"magic":85},"prayer":"mystic_might","boost":"magic","targets":["Dharok the Wretched","Guthan the Infested","Karil the Tainted","Torag the Corrupted","Verac the Defiled"],"gear":{"weapon":11905,"head":4708,"body":4712,"legs":4714,"hands":7462,"feet":4097,"neck":12002,"shield":6889,"cape":21791,"ring":25258},"inventory":[{"id":12926},{"id":4736},{"id":4738},{"id":952},{"id":19629},{"id":3040},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385}]},{"tier":"intermediate","name":"Toxic blowpipe","style":1,"dart":11230,"stats":{"attack":85,"strength":85,"ranged":85,"magic":85},"prayer":"eagle_eye","targets":["Ahrim the Blighted"],"gear":{"weapon":12926,"head":4708,"body":4736,"legs":4738,"hands":7462,"feet":4097,"neck":12002,"cape":21791,"ring":25258}},{"tier":"advanced","name":"Sanguinesti staff","style":0,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"augury","boost":"saturated_heart","targets":["Dharok the Wretched","Guthan the Infested","Karil the Tainted","Torag the Corrupted","Verac the Defiled"],"gear":{"weapon":22323,"head":21018,"body":21021,"legs":21024,"hands":19544,"feet":13235,"neck":12002,"shield":27251,"cape":21791,"ring":28313},"inventory":[{"id":12926},{"id":27238},{"id":27241},{"id":26235},{"id":952},{"id":19629},{"id":27641},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441}]},{"tier":"advanced","name":"Toxic blowpipe","style":1,"dart":11230,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"rigour","targets":["Ahrim the Blighted"],"gear":{"weapon":12926,"head":21018,"body":27238,"legs":27241,"hands":26235,"feet":13235,"neck":12002,"cape":21791,"ring":28313}}]}
```'), "version" = 3, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'barrows-beginners' AND "version" = 2 AND "body" LIKE '%```gear%'
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Gear per brother (magic for five, ranged for Ahrim) and inventories',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v3)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH lib AS (
  UPDATE "guides" SET "body" = regexp_replace("body", '```gear\n.*?\n```', '```gear
{"monster":"Vorkath#Post-quest","setups":[{"tier":"beginner","name":"Rune crossbow","style":1,"stats":{"attack":70,"strength":70,"ranged":80,"magic":70},"prayer":"eagle_eye","boost":"ranging","gear":{"weapon":9185,"ammo":21944,"head":1169,"body":2503,"legs":2497,"hands":2491,"feet":6328,"shield":1540,"cape":10499,"neck":1706},"inventory":[{"id":22209},{"id":12913},{"id":2444},{"id":2434},{"id":2434},{"id":2434},{"id":12791},{"id":2552},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385}],"runePouch":[{"id":556,"q":200},{"id":557,"q":200},{"id":562,"q":100}],"note":"Crumble Undead runes in the pouch for the spawn."},{"tier":"intermediate","name":"Armadyl crossbow","style":1,"stats":{"attack":85,"strength":85,"ranged":90,"magic":85},"prayer":"eagle_eye","boost":"ranging","gear":{"weapon":11785,"ammo":21944,"head":4732,"body":4736,"legs":4738,"hands":7462,"feet":6328,"shield":22002,"cape":10499,"neck":19547,"ring":25260},"inventory":[{"id":22209},{"id":12913},{"id":23733},{"id":2434},{"id":2434},{"id":2434},{"id":12791},{"id":2552},{"id":21946},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":391},{"id":391},{"id":391},{"id":391},{"id":3144},{"id":3144},{"id":3144}],"runePouch":[{"id":556,"q":200},{"id":557,"q":200},{"id":562,"q":100}]},{"tier":"advanced","name":"Dragon hunter crossbow","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"rigour","boost":"ranging","gear":{"weapon":21012,"ammo":21944,"head":27235,"body":27238,"legs":27241,"hands":26235,"feet":13237,"shield":22002,"cape":22109,"neck":25278,"ring":28310},"inventory":[{"id":22209},{"id":12913},{"id":23733},{"id":2434},{"id":2434},{"id":27281},{"id":21946},{"id":23987},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":3144},{"id":3144},{"id":3144},{"id":3144}],"runePouch":[{"id":556,"q":200},{"id":557,"q":200},{"id":562,"q":100},{"id":563,"q":50}]}]}
```'), "version" = 3, "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE "clan_id" IS NULL AND "slug" = 'vorkath-guide' AND "version" = 2 AND "body" LIKE '%```gear%'
  RETURNING "id", "version", "title", "summary", "body"
), lib_rev AS (
  INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
  SELECT "id","version","title","summary","body",'Inventories for every level',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM lib
), copies AS (
  UPDATE "guides" g SET "body" = lib."body", "version" = g."version" + 1, "source_version" = lib."version", "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  FROM lib WHERE g."source_guide_id" = lib."id" AND g."follows_source" = true
  RETURNING g."id", g."version", g."title", g."summary", g."body"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Synced with the Anvil library (v3)',to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') FROM copies ON CONFLICT DO NOTHING;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  SELECT NULL, 'dagannoth-kings', 'Dagannoth Kings', 'Three kings, three weak styles — the classic gear-switching boss, with a setup for each king at every level.', 'bossing', '## What it is
Three dagannoth kings share one lair under Waterbirth Island, and each is weak to exactly one combat style — **the fight that teaches you to switch gear**.
-# The rings (Berserker, Archers, Seers, Warrior) are the drops everyone is here for.

## The kings
- **Dagannoth Rex** — attacks with **melee**, weak to **magic**. *Protect from Melee*
- **Dagannoth Prime** — attacks with **magic**, weak to **ranged**. *Protect from Magic*
- **Dagannoth Supreme** — attacks with **ranged**, weak to **melee**. *Protect from Missiles*
-# Hitting a king with the wrong style barely scratches it — check the setup cards below.

## Getting there
Take a **Waterbirth teleport** or the boat from Rellekka, then head down through the dungeon to the kings. Bring a friend for the door the first time.

::: beginner
## Learning the kings
-# Around 80 in every combat style.
- Go with a team, or kill **one king at a time** and let the others wander
- Bring a weapon for each style: a trident for Rex, a crossbow for Prime, a whip for Supreme
- Pray against the king you''re fighting — they hit hard without it

::: intermediate
## Trips with switches
-# Around 90 combat, Rigour and Augury help a lot.
- Carry the switches in your inventory — the **Inventory Setup** button below copies the whole layout
- Kill Rex first: he''s the one that punishes mistakes most
- Brews and restores, not sharks — trips run longer

::: advanced
## Solo tribrid
-# 99s and endgame gear.
- Shadow for Rex, Twisted bow for Prime, Scythe for Supreme — each dies in well under a minute
- Tag the bank with the **Bank tag** button so resupplying is one click
||Stack all three in the lure spot and kill them in order: Rex, Prime, Supreme.||

:::
```gear
{"monster":"Dagannoth Rex","monsters":["Dagannoth Rex","Dagannoth Prime","Dagannoth Supreme"],"setups":[{"tier":"beginner","name":"Trident vs Rex","style":0,"stats":{"attack":80,"strength":80,"ranged":80,"magic":80},"prayer":"mystic_might","boost":"magic","note":"Rex only takes real damage from magic.","targets":["Dagannoth Rex"],"gear":{"weapon":11905,"head":4089,"body":4091,"legs":4093,"hands":7462,"feet":4097,"neck":1706,"shield":3842,"cape":21791,"ring":25258},"inventory":[{"id":9185},{"id":4151},{"id":12954},{"id":2503},{"id":1079},{"id":12695},{"id":2444},{"id":3040},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":2434},{"id":24953},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385},{"id":385}]},{"tier":"beginner","name":"Crossbow vs Prime","style":1,"stats":{"attack":80,"strength":80,"ranged":80,"magic":80},"prayer":"eagle_eye","boost":"ranging","targets":["Dagannoth Prime"],"gear":{"weapon":9185,"ammo":11875,"head":1169,"body":2503,"legs":2497,"hands":7462,"feet":6328,"neck":1706,"shield":3842,"cape":10499,"ring":25258}},{"tier":"beginner","name":"Whip vs Supreme","style":1,"stats":{"attack":80,"strength":80,"ranged":80,"magic":80},"prayer":["piety"],"boost":"super_combat","targets":["Dagannoth Supreme"],"gear":{"weapon":4151,"shield":12954,"head":10828,"body":10551,"legs":1079,"hands":7462,"feet":11840,"neck":1706,"cape":6570,"ring":25264}},{"tier":"intermediate","name":"Trident of the swamp vs Rex","style":0,"stats":{"attack":90,"strength":90,"ranged":90,"magic":90},"prayer":"augury","boost":"magic","targets":["Dagannoth Rex"],"gear":{"weapon":12899,"head":4708,"body":4712,"legs":4714,"hands":19544,"feet":13235,"neck":12002,"shield":12825,"cape":21791,"ring":25258},"inventory":[{"id":11785},{"id":12006},{"id":22322},{"id":4736},{"id":4738},{"id":11832},{"id":11834},{"id":23685},{"id":23733},{"id":3024},{"id":3024},{"id":3024},{"id":3024},{"id":3024},{"id":6685},{"id":6685},{"id":24953},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441}]},{"tier":"intermediate","name":"Armadyl crossbow vs Prime","style":1,"stats":{"attack":90,"strength":90,"ranged":90,"magic":90},"prayer":"rigour","boost":"ranging","targets":["Dagannoth Prime"],"gear":{"weapon":11785,"ammo":21944,"head":4732,"body":4736,"legs":4738,"hands":7462,"feet":13237,"neck":19547,"shield":21000,"cape":22109,"ring":25260}},{"tier":"intermediate","name":"Tentacle vs Supreme","style":0,"stats":{"attack":90,"strength":90,"ranged":90,"magic":90},"prayer":"piety","boost":"super_combat","targets":["Dagannoth Supreme"],"gear":{"weapon":12006,"shield":22322,"head":24271,"body":11832,"legs":11834,"hands":22981,"feet":13239,"neck":19553,"cape":21295,"ring":25264}},{"tier":"advanced","name":"Tumeken''s shadow vs Rex","style":0,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"augury","boost":"saturated_heart","targets":["Dagannoth Rex"],"gear":{"weapon":27275,"head":21018,"body":21021,"legs":21024,"hands":19544,"feet":13235,"neck":12002,"cape":21791,"ring":28313},"inventory":[{"id":20997},{"id":27238},{"id":27241},{"id":26235},{"id":22325},{"id":26384},{"id":26386},{"id":22981},{"id":23685},{"id":23733},{"id":27641},{"id":3024},{"id":3024},{"id":3024},{"id":3024},{"id":6685},{"id":6685},{"id":24953},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441},{"id":13441}]},{"tier":"advanced","name":"Twisted bow vs Prime","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"rigour","boost":"ranging","targets":["Dagannoth Prime"],"gear":{"weapon":20997,"ammo":11212,"head":27235,"body":27238,"legs":27241,"hands":26235,"feet":13237,"neck":19547,"cape":28951,"ring":28310}},{"tier":"advanced","name":"Scythe vs Supreme","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"piety","boost":"super_combat","targets":["Dagannoth Supreme"],"gear":{"weapon":22325,"head":26382,"body":26384,"legs":26386,"hands":22981,"feet":13239,"neck":29801,"cape":21295,"ring":28307}}]}
```
', 'published', 1, 42, false, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE NOT EXISTS (SELECT 1 FROM "guides" WHERE "clan_id" IS NULL AND "slug" = 'dagannoth-kings')
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
--> statement-breakpoint
WITH g AS (
  INSERT INTO "guides" ("clan_id","slug","title","summary","category","body","status","version","sort_order","follows_source","created_at","updated_at","published_at")
  SELECT NULL, 'moons-of-peril', 'Moons of Peril', 'Three moons beneath Cam Torum, each weak to a different melee style. One armour set, three weapons.', 'bossing', '## What it is
**Moons of Peril** is a boss arena beneath Cam Torum in Varlamore: three moons, fought one after another, then a shared reward chest.
-# Every moon is weak to a different melee style — one armour set, three weapons.

## The moons
- **Blue Moon** — freezing attacks. Weak to **crush**
- **Eclipse Moon** — shadow clones. Weak to **stab**
- **Blood Moon** — bleeding pools. Weak to **slash**

## Supplies
The camp at the entrance lets you cook and brew **moonlight potions** for free — you can run the whole thing on camp supplies.

::: beginner
## First runs
-# Around 75 Attack and Strength.
- A **Dragon warhammer**, **Zamorakian hasta** and **Abyssal whip** cover all three weak spots
- Make moonlight potions at the camp before each run
- Learn one moon at a time: leave after it if you''re low

::: intermediate
## Full runs
-# Around 90 melee.
- **Inquisitor''s mace**, **Osmumten''s fang** and **Abyssal tentacle** — one per moon
- Bandos with torture and an Avernic defender works for all three

::: advanced
## Fast runs
-# 99 melee.
- Full **Inquisitor''s** armour on Blue Moon (crush), Torva for the other two
- The Blade of saeldor on Blood Moon, the fang on Eclipse
||The moons'' reward chest pays out more the faster and cleaner your run.||

:::
```gear
{"monster":"Blue Moon","monsters":["Blue Moon","Eclipse Moon#Regular","Blood Moon"],"setups":[{"tier":"beginner","name":"Dragon warhammer (crush)","style":1,"stats":{"attack":75,"strength":75,"ranged":75,"magic":75},"prayer":"piety","boost":"super_combat","note":"One armour set; swap the weapon for each moon.","targets":["Blue Moon"],"gear":{"head":10828,"body":10551,"legs":21304,"hands":7462,"feet":11840,"neck":6585,"cape":6570,"ring":25264,"shield":12954,"weapon":13576},"inventory":[{"id":4151},{"id":11889},{"id":13576},{"id":12695},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":2434},{"id":2434},{"id":8013}]},{"tier":"beginner","name":"Zamorakian hasta (stab)","style":0,"stats":{"attack":75,"strength":75,"ranged":75,"magic":75},"prayer":"piety","boost":"super_combat","targets":["Eclipse Moon#Regular"],"gear":{"head":10828,"body":10551,"legs":21304,"hands":7462,"feet":11840,"neck":6585,"cape":6570,"ring":25264,"shield":12954,"weapon":11889},"inventory":[{"id":4151},{"id":11889},{"id":13576},{"id":12695},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":2434},{"id":2434},{"id":8013}]},{"tier":"beginner","name":"Abyssal whip (slash)","style":1,"stats":{"attack":75,"strength":75,"ranged":75,"magic":75},"prayer":"piety","boost":"super_combat","targets":["Blood Moon"],"gear":{"head":10828,"body":10551,"legs":21304,"hands":7462,"feet":11840,"neck":6585,"cape":6570,"ring":25264,"shield":12954,"weapon":4151},"inventory":[{"id":4151},{"id":11889},{"id":13576},{"id":12695},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":2434},{"id":2434},{"id":8013}]},{"tier":"intermediate","name":"Inquisitor''s mace (crush)","style":1,"stats":{"attack":90,"strength":90,"ranged":90,"magic":90},"prayer":"piety","boost":"super_combat","targets":["Blue Moon"],"gear":{"head":24271,"body":11832,"legs":11834,"hands":22981,"feet":13239,"neck":19553,"cape":21295,"ring":28307,"shield":22322,"weapon":24417},"inventory":[{"id":12006},{"id":26219},{"id":24417},{"id":23685},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":8013}]},{"tier":"intermediate","name":"Osmumten''s fang (stab)","style":1,"stats":{"attack":90,"strength":90,"ranged":90,"magic":90},"prayer":"piety","boost":"super_combat","targets":["Eclipse Moon#Regular"],"gear":{"head":24271,"body":11832,"legs":11834,"hands":22981,"feet":13239,"neck":19553,"cape":21295,"ring":28307,"shield":22322,"weapon":26219},"inventory":[{"id":12006},{"id":26219},{"id":24417},{"id":23685},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":8013}]},{"tier":"intermediate","name":"Abyssal tentacle (slash)","style":0,"stats":{"attack":90,"strength":90,"ranged":90,"magic":90},"prayer":"piety","boost":"super_combat","targets":["Blood Moon"],"gear":{"head":24271,"body":11832,"legs":11834,"hands":22981,"feet":13239,"neck":19553,"cape":21295,"ring":28307,"shield":22322,"weapon":12006},"inventory":[{"id":12006},{"id":26219},{"id":24417},{"id":23685},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":8013}]},{"tier":"advanced","name":"Inquisitor''s mace (crush)","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"piety","boost":"super_combat","note":"Full Inquisitor boosts crush — swap to Torva for the other two.","targets":["Blue Moon"],"gear":{"head":24419,"body":24420,"legs":24421,"hands":22981,"feet":13239,"neck":29801,"cape":21295,"ring":28307,"shield":22322,"weapon":24417},"inventory":[{"id":26219},{"id":24551},{"id":26382},{"id":26384},{"id":26386},{"id":23685},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":8013}]},{"tier":"advanced","name":"Osmumten''s fang (stab)","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"piety","boost":"super_combat","targets":["Eclipse Moon#Regular"],"gear":{"head":26382,"body":26384,"legs":26386,"hands":22981,"feet":13239,"neck":29801,"cape":21295,"ring":28307,"shield":22322,"weapon":26219},"inventory":[{"id":24417},{"id":24551},{"id":24419},{"id":24420},{"id":24421},{"id":23685},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":8013}]},{"tier":"advanced","name":"Blade of saeldor (slash)","style":1,"stats":{"attack":99,"strength":99,"ranged":99,"magic":99},"prayer":"piety","boost":"super_combat","targets":["Blood Moon"],"gear":{"head":26382,"body":26384,"legs":26386,"hands":22981,"feet":13239,"neck":29801,"cape":21295,"ring":28307,"shield":22322,"weapon":24551},"inventory":[{"id":24417},{"id":26219},{"id":24419},{"id":24420},{"id":24421},{"id":23685},{"id":29080},{"id":29080},{"id":29080},{"id":29080},{"id":8013}]}]}
```
', 'published', 1, 44, false, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  WHERE NOT EXISTS (SELECT 1 FROM "guides" WHERE "clan_id" IS NULL AND "slug" = 'moons-of-peril')
  RETURNING "id","version","title","summary","body","created_at"
)
INSERT INTO "guide_revisions" ("guide_id","version","title","summary","body","note","created_at")
SELECT "id","version","title","summary","body",'Starter library guide',"created_at" FROM g;
