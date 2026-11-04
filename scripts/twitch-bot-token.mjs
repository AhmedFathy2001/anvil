// One-time: get the Anvil bot account's Twitch refresh token — for the `!join` chat bot
// (bot/twitchChat.ts) and the site's stream highlights (lib/highlights, which clip as this account).
// The same file as deploy/twitch-bot-token.mjs in the ops repo, with clips:edit added to the scopes;
// no dependencies, safe to copy there. Re-run it whenever the scopes change, and set the printed
// TWITCH_BOT_REFRESH_TOKEN for BOTH the site and the chat bot.
//
//   TWITCH_BOT_CLIENT_ID=... TWITCH_BOT_CLIENT_SECRET=... node scripts/twitch-bot-token.mjs
//
// 1. Open the printed link in a browser where you are logged in to Twitch AS THE BOT ACCOUNT
//    (a private window works), and press Authorize.
// 2. Twitch sends you back to http://localhost:3999/twitch-bot; this script swaps the code for tokens
//    and prints TWITCH_BOT_REFRESH_TOKEN. Nothing is saved to disk.
//
// The app must list http://localhost:3999/twitch-bot as an OAuth redirect URL.

import http from 'node:http';
import crypto from 'node:crypto';

const id = process.env.TWITCH_BOT_CLIENT_ID;
const secret = process.env.TWITCH_BOT_CLIENT_SECRET;
if (!id || !secret) {
  console.error('Set TWITCH_BOT_CLIENT_ID and TWITCH_BOT_CLIENT_SECRET first.');
  process.exit(1);
}
const REDIRECT = 'http://localhost:3999/twitch-bot';
const state = crypto.randomBytes(16).toString('hex');
const auth = new URL('https://id.twitch.tv/oauth2/authorize');
auth.search = new URLSearchParams({
  client_id: id,
  redirect_uri: REDIRECT,
  response_type: 'code',
  // chat: read + write (+ the Chat Bot badge); clips:edit: stream highlights clip as this account.
  scope: 'user:read:chat user:write:chat user:bot clips:edit',
  state,
  force_verify: 'true',
}).toString();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  if (url.pathname !== '/twitch-bot') return res.writeHead(404).end();
  const done = (msg) => {
    res.writeHead(200, { 'content-type': 'text/plain' }).end(msg);
    server.close();
  };
  if (url.searchParams.get('state') !== state) return done('State mismatch. Run the script again.');
  const code = url.searchParams.get('code');
  if (!code) return done(`Twitch said: ${url.searchParams.get('error_description') ?? 'no code'}`);
  const r = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, code, grant_type: 'authorization_code', redirect_uri: REDIRECT }),
  });
  const t = await r.json();
  if (!r.ok || !t.refresh_token) {
    console.error('Token exchange failed:', t);
    return done('Token exchange failed, see the terminal.');
  }
  const who = await fetch('https://api.twitch.tv/helix/users', {
    headers: { authorization: `Bearer ${t.access_token}`, 'client-id': id },
  }).then((x) => x.json());
  console.log(`\nAuthorized as: ${who?.data?.[0]?.login ?? '?'}  (make sure this is the BOT account)`);
  console.log(`Scopes: ${(t.scope ?? []).join(' ')}`);
  console.log(`\nTWITCH_BOT_REFRESH_TOKEN=${t.refresh_token}\n`);
  done('Done. Go back to the terminal.');
});
server.listen(3999, '127.0.0.1', () => console.log(`Open this while logged in as the bot account:\n\n${auth}\n`));
