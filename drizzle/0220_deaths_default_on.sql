-- "Keep deaths too" (moments_clan_deaths) defaults to ON since the clan feed rework. Clans that saved
-- their Rules page while it defaulted to off still hold an explicit off, which wins over the default.
-- Owner's call (2026-11-05): everyone starts on. Clearing the stored off restores the default; a clan
-- can switch it off again on Admin → Rules. Settings carry no timestamp, so a deliberate off from
-- the last few hours is reset too.
DELETE FROM "settings"
WHERE "key" = 'moments_clan_deaths'
  AND lower(trim(coalesce("value", ''))) IN ('false', '0', 'off', 'no', '');
