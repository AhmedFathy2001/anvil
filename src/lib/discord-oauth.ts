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
//   'own'  — direct Discord OAuth with the configured app. Env creds present.
//   'none' — nothing configured; login can't be offered.
//
// There used to be a third mode, 'brokered', which handed the Discord round trip to the federation
// broker so a managed clan needed no app of its own. Federation is gone; one deployment means one
// Discord app, configured here. Kept ENV-only and synchronous so the start route + login page can
// gate on it without a DB round-trip.
export type OAuthMode = 'own' | 'none';

export function getOAuthMode(): OAuthMode {
  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI) {
    return 'own';
  }
  return 'none';
}

export function isDiscordOAuthConfigured(): boolean {
  return getOAuthMode() !== 'none';
}

/**
 * `join` adds the `guilds.join` scope — the player's OPT-IN for "add me to my event's Discord server
 * automatically" (lib/eventDiscord). Never on a plain login: a sign-in screen that asks to "join
 * servers for you" is exactly what phishing looks like, so it is only asked from the event page where
 * the player pressed the button for it. `prompt=consent` there, since the extra scope needs a screen.
 */
export function buildAuthorizeUrl(state: string, opts: { join?: boolean } = {}): string {
  const { clientId, redirectUri } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: opts.join ? 'identify email guilds.join' : 'identify email',
    state,
    prompt: opts.join ? 'consent' : 'none',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface DiscordTokenSet {
  accessToken: string;
  refreshToken: string | null;
  /** Seconds until the access token expires. */
  expiresIn: number;
  scope: string;
}

/** Exchange a login code, keeping everything the token endpoint returned. */
export async function exchangeCodeForTokenSet(code: string): Promise<DiscordTokenSet> {
  const { clientId, clientSecret, redirectUri } = requireConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
  return postTokenEndpoint(body);
}

/** Refresh a stored grant (lib/discordUserTokens). */
export async function refreshTokenSet(refreshToken: string): Promise<DiscordTokenSet> {
  const { clientId, clientSecret } = requireConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  return postTokenEndpoint(body);
}

async function postTokenEndpoint(body: URLSearchParams): Promise<DiscordTokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord token exchange failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!data.access_token) throw new Error('Discord token response missing access_token');
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresIn: typeof data.expires_in === 'number' ? data.expires_in : 0,
    scope: data.scope ?? '',
  };
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
