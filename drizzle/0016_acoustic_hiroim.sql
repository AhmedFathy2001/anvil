-- SQLite won't accept ADD ... NOT NULL without a default on an existing table,
-- so we seed with empty string, backfill from the existing rsn (lowercased,
-- trimmed, and with any run of whitespace collapsed to a single space —
-- matching normalizeRsn() in src/lib/auth.ts), then create the unique index.
-- The whitespace-collapse is spelled out via REPLACE() because SQLite's TRIM()
-- only handles leading/trailing and there's no regex_replace in the core build.
-- If a production row survives all five REPLACE() calls with consecutive
-- whitespace, that's an RSN shape we don't support; fix it manually first.
DROP INDEX `weekly_participant_unique`;--> statement-breakpoint
ALTER TABLE `weekly_participants` ADD `rsn_normalized` text NOT NULL DEFAULT '';--> statement-breakpoint
UPDATE `weekly_participants`
  SET `rsn_normalized` = LOWER(
    TRIM(
      REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(`rsn`,
        '     ', ' '),
        '    ', ' '),
        '   ', ' '),
        '  ', ' '),
        '  ', ' ')
    )
  );--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_participant_unique` ON `weekly_participants` (`competition_id`,`rsn_normalized`);
