-- Per-character Supporter flair. The existing users.supporter_style remains the fallback so every
-- saved look survives rollout; new edits target the account row.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "supporter_style" text;--> statement-breakpoint

-- A character style changes the versioned plugin flair list just like a rename or visibility edit.
DROP TRIGGER IF EXISTS anvil_flair_accounts_upd ON accounts;--> statement-breakpoint
CREATE TRIGGER anvil_flair_accounts_upd AFTER UPDATE OF player_id, rsn_normalized, verified_at, shared, supporter_style ON accounts
  FOR EACH ROW WHEN (
    OLD.player_id IS DISTINCT FROM NEW.player_id OR OLD.rsn_normalized IS DISTINCT FROM NEW.rsn_normalized
    OR OLD.verified_at IS DISTINCT FROM NEW.verified_at OR OLD.shared IS DISTINCT FROM NEW.shared
    OR OLD.supporter_style IS DISTINCT FROM NEW.supporter_style
  ) EXECUTE FUNCTION anvil_flair_dirty();
