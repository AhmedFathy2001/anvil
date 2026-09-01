-- Personal announcement hooks keep everything they were already getting.
--
-- Levels, quests, diaries and collection-log slots used to post as "combatAchievements", and pets as
-- "rareDrops" -- one kind carrying five. Now that each has a name of its own, a hook whose `kinds`
-- says only "combatAchievements" would stop receiving 99s and quest completions the moment the split
-- shipped, which is not a preference anybody expressed.
--
-- So we expand the subscriptions once, here, rather than teaching the router to guess forever: after
-- this the checkbox list on /profile is the whole truth, and unchecking Levels means no levels.
--
-- Clans need no equivalent -- an unset clan channel falls back to the one it split from at read time
-- (lib/pluginConfig INHERITS_FROM), because "blank" there means "inherit", not "off".
--
-- Row-at-a-time with a local handler because `kinds` is TEXT, not jsonb: one row holding something
-- that isn't a JSON array would abort a set-based UPDATE and take the whole deploy with it. A hook
-- we can't parse is a hook we leave exactly as it is.
DO $$
DECLARE
  hook RECORD;
  expanded text;
BEGIN
  FOR hook IN SELECT id, kinds FROM user_webhooks LOOP
    BEGIN
      SELECT jsonb_agg(DISTINCT k)::text INTO expanded
      FROM jsonb_array_elements_text(hook.kinds::jsonb) AS existing(k0),
           LATERAL (
             SELECT k0 AS k
             UNION ALL
             SELECT unnest(CASE k0
               WHEN 'combatAchievements' THEN ARRAY['levels', 'quests', 'diaries', 'collectionLog']
               WHEN 'rareDrops' THEN ARRAY['pets']
               ELSE ARRAY[]::text[]
             END)
           ) AS more(k);

      IF expanded IS NOT NULL AND expanded <> hook.kinds THEN
        UPDATE user_webhooks SET kinds = expanded WHERE id = hook.id;
      END IF;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'user_webhooks %: kinds left as-is (%)', hook.id, SQLERRM;
    END;
  END LOOP;
END $$;
