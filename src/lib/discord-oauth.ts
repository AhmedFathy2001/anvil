// Discord OAuth2 helpers — minimal client for the "identify" + "email" scopes.
// We only need the user's Discord ID, username, avatar, and (optionally) email
// to create a session-bearing user record.

const AUTHORIZE_URL = 'https://discord.com/oauth2/authorize';
const TOKEN_URL = 'https://discord.com/api/oauth2/token';
const USER_URL = 'https://discord.com/api/users/@me';

export interface DiscordUser {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  email: string | null;
}

function requireConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Discord OAuth is not configured. Set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_REDIRECT_URI.');
  }
  return { clientId, clientSecret, redirectUri };
}

// How this instance logs users in:
//   'own'      — direct Discord OAuth with this instance's own app (self-host / BYO). Env creds present.
//   'brokered' — via the shared Anvil broker: no app of our own; the broker authenticates the Discord
//                identity and hands back a signed assertion we verify (managed default). Requires the
//                provisioner-injected ANVIL_SHARED_LOGIN signal + a broker URL.
//   'none'     — nothing configured; login can't be offered.
// Precedence favours an own app when present (a BYO override), else the shared broker. Kept ENV-only
// and synchronous so the start route + login page can gate on it without a DB round-trip.
export type OAuthMode = 'own' | 'brokered' | 'none';

export function getOAuthMode(): OAuthMode {
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI) {
    return 'own';
  }
  if (isSharedLoginAvailable()) return 'brokered';
  return 'none';
}

// The shared brokered login is available only on instances the provisioner marked managed
// (ANVIL_SHARED_LOGIN) AND that know their broker — an env signal a self-host can't self-declare.
export function isSharedLoginAvailable(): boolean {
  return Boolean(process.env.ANVIL_SHARED_LOGIN && process.env.FEDERATION_BROKER_URL);
}

export function isDiscordOAuthConfigured(): boolean {
  return getOAuthMode() !== 'none';
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify email',
    state,
    prompt: 'none',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = requireConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Discord token response missing access_token');
  }
  return data.access_token;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord user fetch failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
    email?: string | null;
  };
  return {
    id: data.id,
    username: data.username,
    globalName: data.global_name ?? null,
    avatar: data.avatar ?? null,
    email: data.email ?? null,
  };
}

// Discord avatars are served from a CDN; nulls indicate the user has the default avatar.
export function avatarUrl(discordId: string, avatarHash: string | null): string | null {
  if (!avatarHash) return null;
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.${ext}?size=128`;
}
