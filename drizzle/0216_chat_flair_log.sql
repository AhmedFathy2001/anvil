-- IN-GAME SUPPORTER NAMES, LIVE (lib/chatFlairFeed, lib/chatFlairWire). The list the plugin paints in
-- game chat used to refresh on timers only (site cache 5 min, plugin every 10), so a character just
-- confirmed waited up to a quarter of an hour for its colours. Now every change is a numbered version:
--
--   chat_flair_log        one row per version: the delta as plugins get it + the owners it sets
--   chat_flair_snapshots  the whole list at a version, where a fresh app instance starts
--
-- And the tables that decide the list say when they move, on NOTIFY 'anvil_push' as
-- {k:'flairdirty', p:[players.id…], n:[old rsn_normalized…]}: the push server (push/server.ts)
-- gathers a burst and asks the site to work out what changed (api/internal/push/flair). Caught at the
-- table, like migration 0149, so every write path — sign-in verification, plugin login, settings,
-- clan review, renames, merges, Gumroad, gifts, staff tools, crons — is heard without each one
-- remembering to say so. Only rows that can matter speak: a character of someone with a supporter
-- row, and only when a column the list reads actually changed.

CREATE TABLE IF NOT EXISTS "chat_flair_log" (
  "version" integer PRIMARY KEY NOT NULL,
  "msg" text NOT NULL,
  "owners" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_flair_snapshots" (
  "version" integer PRIMARY KEY NOT NULL,
  "state" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION anvil_flair_dirty() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  p integer[] := '{}';
  n text[] := '{}';
BEGIN
  IF TG_TABLE_NAME = 'accounts' THEN
    IF TG_OP <> 'INSERT' THEN p := p || OLD.player_id; n := n || OLD.rsn_normalized; END IF;
    IF TG_OP <> 'DELETE' THEN p := p || NEW.player_id; END IF;
    IF NOT EXISTS (
      SELECT 1 FROM users u JOIN supporter_subscriptions s ON s.user_id = u.id WHERE u.player_id = ANY(p)
    ) THEN RETURN NULL; END IF;
  ELSIF TG_TABLE_NAME = 'users' THEN
    IF NOT EXISTS (SELECT 1 FROM supporter_subscriptions s WHERE s.user_id = NEW.id) THEN RETURN NULL; END IF;
    p := array_remove(ARRAY[OLD.player_id, NEW.player_id], NULL);
  ELSE
    -- supporter_subscriptions: whoever the row belongs (or belonged) to.
    SELECT coalesce(array_agg(u.player_id), '{}') INTO p FROM users u
      WHERE u.player_id IS NOT NULL
        AND u.id IN (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
                     CASE WHEN TG_OP = 'INSERT' THEN NEW.user_id ELSE OLD.user_id END);
  END IF;
  IF cardinality(p) = 0 AND cardinality(n) = 0 THEN RETURN NULL; END IF;
  PERFORM pg_notify('anvil_push', json_build_object('k', 'flairdirty', 'p', p, 'n', n)::text);
  RETURN NULL;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_flair_accounts_upd ON accounts;--> statement-breakpoint
CREATE TRIGGER anvil_flair_accounts_upd AFTER UPDATE OF player_id, rsn_normalized, verified_at, shared ON accounts
  FOR EACH ROW WHEN (
    OLD.player_id IS DISTINCT FROM NEW.player_id OR OLD.rsn_normalized IS DISTINCT FROM NEW.rsn_normalized
    OR OLD.verified_at IS DISTINCT FROM NEW.verified_at
    OR OLD.shared IS DISTINCT FROM NEW.shared
  ) EXECUTE FUNCTION anvil_flair_dirty();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_flair_accounts_insdel ON accounts;--> statement-breakpoint
CREATE TRIGGER anvil_flair_accounts_insdel AFTER INSERT OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION anvil_flair_dirty();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_flair_users ON users;--> statement-breakpoint
CREATE TRIGGER anvil_flair_users AFTER UPDATE OF game_chat_flair, supporter_style, player_id ON users
  FOR EACH ROW WHEN (
    OLD.game_chat_flair IS DISTINCT FROM NEW.game_chat_flair OR OLD.supporter_style IS DISTINCT FROM NEW.supporter_style
    OR OLD.player_id IS DISTINCT FROM NEW.player_id
  ) EXECUTE FUNCTION anvil_flair_dirty();--> statement-breakpoint
DROP TRIGGER IF EXISTS anvil_flair_subscriptions ON supporter_subscriptions;--> statement-breakpoint
CREATE TRIGGER anvil_flair_subscriptions AFTER INSERT OR UPDATE OR DELETE ON supporter_subscriptions
  FOR EACH ROW EXECUTE FUNCTION anvil_flair_dirty();
