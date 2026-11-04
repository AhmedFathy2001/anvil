// One-time (optional): get the !join bot account's Kick refresh token. The Kick twin of
// deploy/twitch-bot-token.mjs (in the ops repo); no dependencies, safe to copy there.
//
//   KICK_CLIENT_ID=... KICK_CLIENT_SECRET=... node scripts/kick-bot-token.mjs
//
// Only needed if `!join` replies should be sent AS a specific Kick account (anvil_osrs) with that
// account's own token. Without KICK_BOT_REFRESH_TOKEN the site replies through each host's own token
// as the Kick app's bot — which is anvil_osrs if the app was created while logged in as anvil_osrs.
//
// 1. Open the printed link in a browser where you are logged in to Kick AS THE BOT ACCOUNT (a private
//    window works), and press Allow.
// 2. Kick sends you back to http://localhost:3999/kick-bot; this script swaps the code for tokens
//    (OAuth 2.1 + PKCE) and prints KICK_BOT_REFRESH_TOKEN. Nothing is saved to disk.
//
// The Kick app must list http://localhost:3999/kick-bot as a redirect URL.
// Put the value in the site's env; the site stores the rotated token itself after first use.

import http from 'node:http';
import crypto from 'node:crypto';

const id = process.env.KICK_CLIENT_ID;
const secret = process.env.KICK_CLIENT_SECRET;
if (!id || !secret) {
  console.error('Set KICK_CLIENT_ID and KICK_CLIENT_SECRET first.');
  process.exit(1);
}
const REDIRECT = 'http://localhost:3999/kick-bot';
const state = crypto.randomBytes(16).toString('hex');
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const auth = new URL('https://id.kick.com/oauth/authorize');
auth.search = new URLSearchParams({
  response_type: 'code',
  client_id: id,
  redirect_uri: REDIRECT,
  scope: 'user:read chat:write',
  code_challenge: challenge,
  code_challenge_method: 'S256',
  state,
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  if (url.pathname !== '/kick-bot') return res.writeHead(404).end();
  const done = (msg) => {
    res.writeHead(200, { 'content-type': 'text/plain' }).end(msg);
    server.close();
  };
  if (url.searchParams.get('state') !== state) return done('State mismatch. Run the script again.');
  const code = url.searchParams.get('code');
  if (!code) return done(`Kick said: ${url.searchParams.get('error_description') ?? url.searchParams.get('error') ?? 'no code'}`);
  const r = await fetch('https://id.kick.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: id,
      client_secret: secret,
      code,
      redirect_uri: REDIRECT,
      code_verifier: verifier,
    }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.refresh_token) {
    console.error('Token exchange failed:', r.status, t);
    return done('Token exchange failed, see the terminal.');
  }
  const who = await fetch('https://api.kick.com/public/v1/users', {
    headers: { authorization: `Bearer ${t.access_token}`, accept: 'application/json' },
  })
    .then((x) => x.json())
    .catch(() => null);
  console.log(`\nAuthorized as: ${who?.data?.[0]?.name ?? '?'}  (make sure this is the BOT account)`);
  console.log(`Scopes: ${t.scope ?? ''}`);
  console.log(`\nKICK_BOT_REFRESH_TOKEN=${t.refresh_token}\n`);
  done('Done. Go back to the terminal.');
});
server.listen(3999, '127.0.0.1', () => console.log(`Open this while logged in to Kick as the bot account:\n\n${auth}\n`));
