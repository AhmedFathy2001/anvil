import { jsonWithEtag } from '@/lib/httpEtag';
import { loadTrackedConfig } from '@/lib/pluginFacts/load';
import { buildRuleTable, huntDropRules } from '@/lib/pluginFacts/rules';
import { huntTargetsFor } from '@/lib/itemHuntDb';
import { pluginViewerRsn, verifyPluginTokenUser, resolvePluginClan } from '@/lib/auth';
import { rareTableFor } from '@/lib/notifyDropItems';
import { pluginVersionHeader } from '@/lib/pluginSeen';
import { huntPopupsSupportedBy, raidFactsSupportedBy } from '@/lib/tileConditionsCheck';

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
  const table = buildRuleTable(loaded.cfg, { raidFacts });
  // The clan's running item hunts this character is in: their targets get the drop popup and a line
  // (lib/itemHuntDb huntTargetsFor). Only for a plugin that knows a hunt rule; an older one would
  // count it as a tile.
  if (huntPopupsSupportedBy(pluginVersionHeader(request))) {
    const hunts = huntDropRules(await huntTargetsForCaller(request).catch(() => []));
    for (const [id, rules] of Object.entries(hunts)) table.drops[id] = [...(table.drops[id] ?? []), ...rules] as typeof table.drops[string];
  }
  return jsonWithEtag(request, { ...table, rare: await rareTableFor(floor) });
}

// A signed-in plugin with or without a live board (a hunt runs without one). The character is the
// one it plays as; a wrong name only costs a popup, since the drop report decides what counts.
async function huntTargetsForCaller(request: Request) {
  const user = await verifyPluginTokenUser(request);
  const clan = user ? await resolvePluginClan(request, user.userId) : null;
  return clan ? huntTargetsFor(clan.id, pluginViewerRsn(request)) : [];
}
