import crypto from 'crypto';

import { requireSecret } from '@/lib/env';

// Links to one proof's picture for the plugin's side panel (lib/pluginUi proofsUi), served by
// /api/plugin/proof-image/<id>: `?t=1` is a small JPEG thumbnail, without it a redirect to the full
// image on the media host. The panel only ever downloads from the site's own address, never a URL a
// row carries, and it downloads kilobytes.
//
// SIGNED, because the route is anonymous (a browser opening the full picture has no plugin token):
// the signature is only handed to someone the panel showed the proof to, and it covers the image URL
// too — a replaced picture is a new link, so a cached thumbnail is never the old one.

const PURPOSE = 'proof-image:v1';

/** The thumbnail's box: the panel draws it at half this, so a HiDPI screen still gets a sharp one. */
export const THUMB_W = 128;
export const THUMB_H = 80;

function secret(): string {
  return requireSecret('ADMIN_SESSION_SECRET', 'dev-admin-secret');
}

export function proofImageSig(id: number, imageUrl: string): string {
  return crypto.createHmac('sha256', secret()).update(`${PURPOSE}|${id}|${imageUrl}`).digest('base64url').slice(0, 22);
}

/** Does `sig` belong to this submission's current picture? Constant-time. */
export function proofImageSigOk(id: number, imageUrl: string, sig: string | null): boolean {
  if (!sig) return false;
  const want = Buffer.from(proofImageSig(id, imageUrl));
  const got = Buffer.from(sig);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

/** The site path for a proof's picture: its thumbnail, or (`full`) the page that opens the whole image. */
export function proofImagePath(id: number, imageUrl: string, full = false): string {
  return `/api/plugin/proof-image/${id}?${full ? '' : 't=1&'}s=${proofImageSig(id, imageUrl)}`;
}
