-- First run, for a person and for a clan.
--
-- Both flows used to be implicit, because a deployment was a clan: you arrived at your clan's site,
-- so there was always a clan, and "set up your account" meant the one thing left — point the plugin
-- at it. On one platform the front door is the apex, where a new person has no clan, no character
-- and nothing telling them what to do next.

-- WHERE SOMEBODY GOT TO. Deliberately only two columns, because the STEPS are derived from facts
-- that already exist — an account row, a seat, a plugin ping — and a stored step counter would be a
-- second answer to a question the data already answers, free to drift from it. What cannot be
-- derived is intent: that they finished, and which steps they chose to pass on so nothing nags them
-- about it again.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at text;

--> statement-breakpoint
-- A JSON array of step keys. Text rather than a Postgres array so it reads the same way every other
-- small structured column in this schema does, and so adding a step is not a type change.
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_skipped text NOT NULL DEFAULT '[]';

--> statement-breakpoint
-- THE CLAN NAME HAD TWO SOURCES AND THE WRONG ONE WON.
--
-- `clans.name` is set by /clans/new and by staff; the `clan_name` setting is written by the admin
-- settings page. Every reader went to the setting, so a clan created through the newer flow — which
-- writes the column and no setting at all — resolved to the hardcoded fallback and rendered its own
-- home page as "Anvil", in the title, the hero and the nav.
--
-- getClanDisplayName now reads the column first, matching what getInGameClanName already did for
-- the same reason. This backfills the other direction: where a clan has edited its name through the
-- settings page since being created, the setting is the more recent truth and the column is stale,
-- so the column takes it. Untouched where they already agree, or where there is no setting.
UPDATE clans c
SET name = s.value
FROM settings s
WHERE s.clan_id = c.id
  AND s.key = 'clan_name'
  AND s.value IS NOT NULL
  AND btrim(s.value) <> ''
  AND btrim(s.value) <> btrim(c.name);
