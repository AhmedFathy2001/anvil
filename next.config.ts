import type { NextConfig } from "next";

// Response headers every page and API answer carries.
//
// FRAMING is the one that matters most. Nothing stopped another site putting any Anvil page in an
// invisible iframe, and some pages act on one click — /link-device?code=… pre-fills a code and
// "Approve" binds that RuneLite client to whoever is signed in. Framed under a decoy button, that is
// an account takeover. So nothing may be framed except the two things made to be: the Discord card
// and badge, which set their own CSP (frame-ancestors *) in their route.
//
// The CSP here is deliberately narrow — framing, <base> and plugins — because a script policy needs
// nonces threaded through Next's inline bootstrap, and a wrong one breaks every page at once.
const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Two years, every subdomain (every clan host is HTTPS behind Cloudflare). Not `preload`: that is
  // a one-way submission to the browsers' lists and wants deciding on its own.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) so the Docker image can run the app
  // with just Node — no node_modules, no `next start`. Required for the per-clan container deploy.
  output: 'standalone',

  async headers() {
    return [
      {
        // Everything except the embeddable Discord card and badge, at the apex or under a clan prefix.
        source: '/:path((?!(?:c/[^/]+/)?api/discord/(?:embed|badge)).*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
