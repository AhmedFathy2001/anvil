import { NextRequest } from 'next/server';

import { isApexHost, resolveClanByHost } from '@/lib/clanContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Caddy's on-demand TLS gate.
 *
 * Caddy asks here before minting a certificate for any host it has not seen, and issues only on a
 * 2xx. Without it, anyone who points a DNS record at this box makes us request a certificate for
 * their name — which is both an abuse vector and a fast route through Let's Encrypt's rate limits,
 * after which real clans stop getting certs.
 *
 * The check is the SAME resolution the app itself uses, deliberately. A host that would 404 as a
 * page must not be worth a certificate, and keeping two notions of "is this a real host" in step by
 * hand is how they drift.
 *
 * Moved here from the control plane along with everything else: there is one app now, so the thing
 * that knows which hosts are real is this one.
 */
export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get('domain') || '').toLowerCase().trim();
  if (!domain) return new Response('no domain', { status: 400 });

  // The apex serves its own certificate and should never reach here; allowed defensively so a
  // config change cannot lock the platform out of its own name.
  if (isApexHost(domain)) return new Response('ok', { status: 200 });

  const clan = await resolveClanByHost(domain);
  if (!clan) return new Response('no', { status: 403 });

  // An archived clan keeps serving read-only history — links and profiles should not rot — so it
  // still needs a certificate. Only a clan that resolves to nothing is refused.
  return new Response('ok', { status: 200 });
}
