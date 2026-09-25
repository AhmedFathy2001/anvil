-- Claims used to move an account onto the Discord person's row and deliberately leave the roster
-- placeholder behind. The claim paths now merge it transactionally, but old placeholders that carry
-- absolutely nothing are still visible as duplicate people in the operator directory.
--
-- Delete only rows no table references. A placeholder carrying a ban, join request or invite needs a
-- known surviving person to move that history to, so those stay for the explicit staff merge tool.
DELETE FROM "players" p
WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."player_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "users" u WHERE u."player_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "clan_bans" b WHERE b."player_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "clan_join_requests" r WHERE r."player_id" = p."id")
  AND NOT EXISTS (SELECT 1 FROM "event_invites" i WHERE i."player_id" = p."id");
