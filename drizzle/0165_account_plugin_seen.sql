-- Which plugin build last played each character (lib/pluginSeen), for the tile viewer's
-- "your plugin is too old for this tile" check (lib/tileReadiness). A sidecar, not accounts columns:
-- the plugin polls every 30 s and the accounts row is the hot one.
-- Journal `when` is later than the reserved 0163 (fix/clan-event-posts, 1793609600000), so this still
-- applies when 0163 lands first. If this lands BEFORE 0163, re-stamp 0163 past it or it is skipped.
CREATE TABLE IF NOT EXISTS "account_plugin_seen" (
	"account_id" integer PRIMARY KEY NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
	"plugin_version" text NOT NULL,
	"seen_at" text NOT NULL
);
