// A clan header as middleware would forward it: the slug plus its proof (lib/requestHeaderProof).
// lib/clanContext ignores a bare slug, so a test that addresses a clan the way a `/c/<slug>/…`
// request would must sign it. node:crypto here, on purpose: synchronous, so it drops into the
// object-literal headers the tests already build — and it doubles as a cross-check that the
// WebCrypto signer produces the same bytes.
import { createHmac } from 'node:crypto';

export function clanHeaders(slug: string): Record<string, string> {
  const secret = process.env.ADMIN_SESSION_SECRET || 'dev-admin-secret';
  return {
    'x-anvil-clan-slug': slug,
    'x-anvil-clan-proof': createHmac('sha256', secret).update(`anvil-clan-header:${slug}`).digest('hex'),
  };
}
