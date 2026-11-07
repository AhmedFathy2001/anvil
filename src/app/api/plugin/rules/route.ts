import { jsonWithEtag } from '@/lib/httpEtag';
import { loadTrackedConfig } from '@/lib/pluginFacts/load';
import { buildRuleTable } from '@/lib/pluginFacts/rules';

export const dynamic = 'force-dynamic';

// GET /api/plugin/rules — the rule table a `rules` plugin decides screenshots and instant chat lines
// by (lib/pluginFacts/rules). Same auth and scope as /api/plugin/config; ETag'd, so an unchanged
// table costs a 304.
export async function GET(request: Request) {
  const loaded = await loadTrackedConfig(request);
  if (!loaded.ok) return Response.json({ error: 'No config' }, { status: loaded.status });
  return jsonWithEtag(request, buildRuleTable(loaded.cfg));
}
