import { jsonWithEtag } from '@/lib/httpEtag';

export const dynamic = 'force-dynamic';

// GET /api/plugin/federation/state — RETIRED. Federation was removed; clans now live in one site, so
// there is nothing to aggregate across instances.
//
// This is a tombstone rather than a deletion because plugins are never force-updated: builds in the
// wild poll this endpoint on every sidebar refresh and will keep doing so indefinitely. It returns
// the exact payload the plugin already got when an admin had federation switched OFF — a shape those
// builds have always handled — so an un-updated client renders "no connected clans" instead of
// surfacing a 404 in the panel. No new client behaviour is being relied on.
export async function GET(request: Request) {
  return jsonWithEtag(request, {
    enabled: false,
    connected: false,
    needsLogin: false,
    clans: [],
    shareEligible: false,
  });
}
