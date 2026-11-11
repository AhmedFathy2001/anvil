-- 1.20.0 added users.whats_new_seen (0252) empty for everyone. The bell's first poll treats an empty
-- marker as a brand-new account and jumps it to the newest entry, so nobody got the 1.20 notice.
-- Wind every marker that sits on a 1.20 entry back to the last entry 1.19.9 shipped; the bell then
-- shows the 1.20 entries once. Anyone who already opened /whats-new sees them one more time.
UPDATE "users" SET "whats_new_seen" = '2026-11-07-name-looks'
WHERE "whats_new_seen" IN (
  '2026-11-11-feed-chat-page', '2026-11-11-race-hidden-tiles', '2026-11-11-streaks-heat',
  '2026-11-11-supporter-tenure-gifts', '2026-11-11-same-name-clogs', '2026-11-09-side-panel',
  '2026-11-09-team-competitions', '2026-11-09-announcements', '2026-11-09-my-announcements',
  '2026-11-09-chat-channels', '2026-11-09-races', '2026-11-09-records'
);
