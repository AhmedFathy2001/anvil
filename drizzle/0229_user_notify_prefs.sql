-- What a person's plugin posts to Discord (lib/notifyPrefs), moved off the RuneLite config. NULL = never
-- set: the defaults apply, and the plugin's one-time upload of its old settings may fill it.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_prefs" text;
