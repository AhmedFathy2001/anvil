import { jsonWithEtag } from '@/lib/httpEtag';
import { loadTrackedConfig } from '@/lib/pluginFacts/load';
import { buildRuleTable } from '@/lib/pluginFacts/rules';
import { rareTableFor } from '@/lib/notifyDropItems';
import { pluginVersionHeader } from '@/lib/pluginSeen';
import { raidFactsSupportedBy } from '@/lib/tileConditionsCheck';

export const dynamic = 'force-dynamic';

// GET /api/plugin/rules — the rule table a `rules` plugin decides screenshots and instant chat lines
// by (lib/pluginFacts/rules), plus the rare-drop screenshot gate. Same auth and scope as /api/plugin/config; ETag'd, so an unchanged
// table costs a 304.
export async function GET(request: Request) {
  const loaded = await loadTrackedConfig(request);
  if (!loaded.ok) return Response.json({ error: 'No config' }, { status: loaded.status });
  // `rare`: source → item ids that could clear this person's rarity floor (lib/notifyDrops) — loot
  // holding one is screenshotted and sent to /api/plugin/notify, which judges the post.
  const floor = (loaded.cfg as { me?: { floor?: number } }).me?.floor;
  // Raid rules (lib/tileConditions) only for a plugin that sends raid facts.
  const raidFacts = raidFactsSupportedBy(pluginVersionHeader(request));
  return jsonWithEtag(request, { ...buildRuleTable(loaded.cfg, { raidFacts }), rare: await rareTableFor(floor) });
}
