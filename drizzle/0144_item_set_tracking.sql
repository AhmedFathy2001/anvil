-- Item-set tiles that the plugin never saw. Data only, idempotent.
--
-- The bulk tile import (also behind "start from a starter board") stored a collection's items in
-- item_requirements and left tracked_item_ids NULL, unlike the single-tile editor, which fills both.
-- The plugin config, search, balance and moments all read tracked_item_ids, so those tiles never
-- auto-credited. Found on The Uprising's starter board (Dragon boots etc.), 2026-10-22. The import
-- now fills both; this backfills every existing tile, in every clan, from its own item set.
UPDATE "tiles" SET "tracked_item_ids" = (
    SELECT jsonb_agg((r ->> 'itemId')::int ORDER BY ord)
    FROM jsonb_array_elements("item_requirements"::jsonb) WITH ORDINALITY AS e(r, ord)
  )::text
WHERE "item_requirements" IS NOT NULL
  AND jsonb_typeof("item_requirements"::jsonb) = 'array'
  AND jsonb_array_length("item_requirements"::jsonb) > 0
  AND ("tracked_item_ids" IS NULL OR "tracked_item_ids" IN ('', '[]'))
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements("item_requirements"::jsonb) r
    WHERE jsonb_typeof(r -> 'itemId') IS DISTINCT FROM 'number'
  );--> statement-breakpoint
-- The starter content's single-item drops ("Dragon boots") had no amount, so they imported as a
-- one-item SET ("Get EVERY item below (1 item)"). Give them their item's count as the amount so
-- they import as plain drops. Same meaning, plain wording. Mirrors 0142: bump the version,
-- rewrite following copies; edited copies get it as an offer.
UPDATE "library_tasks" SET
  "config" = ("config"::jsonb || jsonb_build_object('requiredAmount', COALESCE(("config"::jsonb -> 'items' -> 0 ->> 'count')::int, 1)))::text,
  "version" = "version" + 1,
  "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE "config"::jsonb ->> 'tileType' = 'drop'
    AND jsonb_typeof("config"::jsonb -> 'items') = 'array' AND jsonb_array_length("config"::jsonb -> 'items') = 1
    AND ("config"::jsonb -> 'requiredAmount' IS NULL OR "config"::jsonb -> 'requiredAmount' = 'null'::jsonb)
    AND COALESCE("config"::jsonb -> 'items' -> 0 ->> 'group', '') = '';--> statement-breakpoint
-- clan-scope: global -- exactly the copies that chose to follow these Anvil tasks, in every clan.
UPDATE "tile_library" tl SET "config" = lt."config", "source_version" = lt."version"
FROM "library_tasks" lt
WHERE tl."source_task_id" = lt."id" AND tl."follows_source" = true
  AND COALESCE(tl."source_version", 0) < lt."version";--> statement-breakpoint
UPDATE "library_boards" b SET
  "tiles" = (
    SELECT jsonb_agg(
      CASE WHEN e.t ->> 'tileType' = 'drop'
    AND jsonb_typeof(e.t -> 'items') = 'array' AND jsonb_array_length(e.t -> 'items') = 1
    AND (e.t -> 'requiredAmount' IS NULL OR e.t -> 'requiredAmount' = 'null'::jsonb)
    AND COALESCE(e.t -> 'items' -> 0 ->> 'group', '') = ''
        THEN e.t || jsonb_build_object('requiredAmount', COALESCE((e.t -> 'items' -> 0 ->> 'count')::int, 1))
        ELSE e.t
      END ORDER BY e.ord)
    FROM jsonb_array_elements(b."tiles"::jsonb) WITH ORDINALITY AS e(t, ord)
  )::text,
  "version" = "version" + 1,
  "updated_at" = to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
WHERE b."origin" = 'anvil'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(b."tiles"::jsonb) AS e(t)
    WHERE e.t ->> 'tileType' = 'drop'
    AND jsonb_typeof(e.t -> 'items') = 'array' AND jsonb_array_length(e.t -> 'items') = 1
    AND (e.t -> 'requiredAmount' IS NULL OR e.t -> 'requiredAmount' = 'null'::jsonb)
    AND COALESCE(e.t -> 'items' -> 0 ->> 'group', '') = ''
  );
