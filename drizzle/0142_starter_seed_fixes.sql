-- Starter content fixes, data only (no schema change).
--
-- 1. "Any Barrows piece" listed only the six weapons, so a Barrows helm, body or legs never
--    auto-credited (found on The Uprising's first event, 2026-10-22). Now all 24 pieces. Bolt racks
--    are deliberately not on it.
-- 2. The starter raid tiles ("5 CoX/ToB/ToA completions") credited a raid once per teammate in it,
--    so a 3-man raid ticked the tile 3 times. They now count a shared raid once (coopCredit per-kill).
--
-- Only rows that still hold the broken starter config are touched; anything staff or a clan edited
-- is left alone. Version bumps mirror lib/libraryTasks.updateAnvilTask: following clan copies are
-- rewritten here, and edited (forked) copies see the change as an offer. Events already created
-- from a board keep their own tiles — a board is never followed.
UPDATE "library_tasks" SET
  "config" = jsonb_set("config"::jsonb, '{items}', '[{"name": "Ahrim''s hood", "count": 1}, {"name": "Ahrim''s robetop", "count": 1}, {"name": "Ahrim''s robeskirt", "count": 1}, {"name": "Ahrim''s staff", "count": 1}, {"name": "Dharok''s helm", "count": 1}, {"name": "Dharok''s platebody", "count": 1}, {"name": "Dharok''s platelegs", "count": 1}, {"name": "Dharok''s greataxe", "count": 1}, {"name": "Guthan''s helm", "count": 1}, {"name": "Guthan''s platebody", "count": 1}, {"name": "Guthan''s chainskirt", "count": 1}, {"name": "Guthan''s warspear", "count": 1}, {"name": "Karil''s coif", "count": 1}, {"name": "Karil''s leathertop", "count": 1}, {"name": "Karil''s leatherskirt", "count": 1}, {"name": "Karil''s crossbow", "count": 1}, {"name": "Torag''s helm", "count": 1}, {"name": "Torag''s platebody", "count": 1}, {"name": "Torag''s platelegs", "count": 1}, {"name": "Torag''s hammers", "count": 1}, {"name": "Verac''s helm", "count": 1}, {"name": "Verac''s brassard", "count": 1}, {"name": "Verac''s plateskirt", "count": 1}, {"name": "Verac''s flail", "count": 1}]'::jsonb)::text,
  "version" = "version" + 1,
  "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE "key" = 'drop-barrows-piece' AND jsonb_array_length("config"::jsonb -> 'items') = 6;--> statement-breakpoint
UPDATE "library_tasks" SET
  "config" = ("config"::jsonb || '{"coopCredit":"per-kill"}'::jsonb)::text,
  "version" = "version" + 1,
  "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE "key" IN ('kc-cox-5', 'kc-tob-5', 'kc-toa-5') AND NOT ("config"::jsonb ? 'coopCredit');--> statement-breakpoint
-- clan-scope: global -- exactly the copies that chose to follow these Anvil tasks, in every clan.
UPDATE "tile_library" tl SET "config" = lt."config", "source_version" = lt."version"
FROM "library_tasks" lt
WHERE tl."source_task_id" = lt."id" AND tl."follows_source" = true
  AND lt."key" IN ('drop-barrows-piece', 'kc-cox-5', 'kc-tob-5', 'kc-toa-5')
  AND COALESCE(tl."source_version", 0) < lt."version";--> statement-breakpoint
UPDATE "library_boards" b SET
  "tiles" = (
    SELECT jsonb_agg(
      CASE
        WHEN e.t ->> 'tileType' = 'drop' AND e.t ->> 'label' = 'Any Barrows piece'
             AND jsonb_array_length(e.t -> 'items') = 6
          THEN jsonb_set(e.t, '{items}', '[{"name": "Ahrim''s hood", "count": 1}, {"name": "Ahrim''s robetop", "count": 1}, {"name": "Ahrim''s robeskirt", "count": 1}, {"name": "Ahrim''s staff", "count": 1}, {"name": "Dharok''s helm", "count": 1}, {"name": "Dharok''s platebody", "count": 1}, {"name": "Dharok''s platelegs", "count": 1}, {"name": "Dharok''s greataxe", "count": 1}, {"name": "Guthan''s helm", "count": 1}, {"name": "Guthan''s platebody", "count": 1}, {"name": "Guthan''s chainskirt", "count": 1}, {"name": "Guthan''s warspear", "count": 1}, {"name": "Karil''s coif", "count": 1}, {"name": "Karil''s leathertop", "count": 1}, {"name": "Karil''s leatherskirt", "count": 1}, {"name": "Karil''s crossbow", "count": 1}, {"name": "Torag''s helm", "count": 1}, {"name": "Torag''s platebody", "count": 1}, {"name": "Torag''s platelegs", "count": 1}, {"name": "Torag''s hammers", "count": 1}, {"name": "Verac''s helm", "count": 1}, {"name": "Verac''s brassard", "count": 1}, {"name": "Verac''s plateskirt", "count": 1}, {"name": "Verac''s flail", "count": 1}]'::jsonb)
        WHEN e.t ->> 'tileType' = 'kill' AND NOT (e.t ? 'coopCredit')
             AND e.t -> 'targetNpcs' ?| ARRAY['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut']
          THEN e.t || '{"coopCredit":"per-kill"}'::jsonb
        ELSE e.t
      END ORDER BY e.ord)
    FROM jsonb_array_elements(b."tiles"::jsonb) WITH ORDINALITY AS e(t, ord)
  )::text,
  "version" = "version" + 1,
  "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE b."origin" = 'anvil'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(b."tiles"::jsonb) AS e(t)
    WHERE (e.t ->> 'tileType' = 'drop' AND e.t ->> 'label' = 'Any Barrows piece' AND jsonb_array_length(e.t -> 'items') = 6)
       OR (e.t ->> 'tileType' = 'kill' AND NOT (e.t ? 'coopCredit')
           AND e.t -> 'targetNpcs' ?| ARRAY['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut'])
  );
