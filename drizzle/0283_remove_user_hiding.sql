-- The two user-facing hiding switches are gone: every character is public (accounts.shared) and
-- every reported in-game clan shows (account_game_clans.hidden). Platform hiding (players.banned,
-- clans.platform_hidden) and a clan's own visibility settings are untouched.
--
-- The flair trigger watched `shared`; it is recreated without it first, so the column can drop.
DROP TRIGGER IF EXISTS anvil_flair_accounts_upd ON accounts;
--> statement-breakpoint
CREATE TRIGGER anvil_flair_accounts_upd AFTER UPDATE OF player_id, rsn_normalized, verified_at, supporter_style ON accounts
  FOR EACH ROW WHEN (
    OLD.player_id IS DISTINCT FROM NEW.player_id OR OLD.rsn_normalized IS DISTINCT FROM NEW.rsn_normalized
    OR OLD.verified_at IS DISTINCT FROM NEW.verified_at
    OR OLD.supporter_style IS DISTINCT FROM NEW.supporter_style
  ) EXECUTE FUNCTION anvil_flair_dirty();
--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "shared";
--> statement-breakpoint
ALTER TABLE "account_game_clans" DROP COLUMN IF EXISTS "hidden";
