/**
 * A person's personal webhook URL is user-supplied and the SERVER posts to it, so it must be a real
 * Discord webhook and nothing else — otherwise it is an SSRF: "forward my drops to http://169.254…"
 * would have the server fetch an internal address. Restricting the host to Discord's own domains and
 * the path to /api/webhooks/ closes that: the only thing this URL can ever reach is a Discord webhook.
 */
const DISCORD_HOSTS = new Set([
  'discord.com',
  'discordapp.com',
  'ptb.discord.com',
  'canary.discord.com',
]);

/**
 * A Discord webhook URL, parsed ONE way for the whole app. Every check, id extraction, pool key, scan
 * and blocklist test goes through parseDiscordWebhook, so no two places can disagree about which
 * webhook a URL is: a leading-zero id, a percent-encoded path, an odd host or path all normalize the
 * same way here, or are refused.
 */
export interface ParsedWebhook {
  /** Canonical id: digits, no leading zeros (BigInt round-trip). */
  id: string;
  token: string;
  /** The normalized webhook URL, https://discord.com/api/webhooks/<id>/<token>. This is what is stored. */
  url: string;
  /** What a sender fetches: the normalized URL plus any /messages/<id> and query it was given. */
  requestUrl: string;
}

const WEBHOOK_PATH = /^\/api\/(?:v\d{1,2}\/)?webhooks\/(\d{1,25})\/([A-Za-z0-9_-]{1,120})(\/messages\/[A-Za-z0-9_-]{1,64})?\/?$/;
const MAX_SNOWFLAKE = BigInt('18446744073709551615');

/**
 * Parse a webhook URL, or null. `target` is the senders' form: it may address a message
 * (`/messages/<id>`) and carry a query (`?wait=true`). Without it the URL must be exactly a webhook,
 * no query or fragment. Encoded characters, credentials, ports and non-Discord hosts are refused.
 */
export function parseDiscordWebhook(raw: string, opts: { target?: boolean } = {}): ParsedWebhook | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (!text || /\s/.test(text)) return null;
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (!DISCORD_HOSTS.has(u.hostname.toLowerCase())) return null;
  // Anything percent-encoded could decode differently somewhere else: refuse rather than guess.
  if (u.pathname.includes('%')) return null;
  if (!opts.target && (u.search || u.hash)) return null;
  const m = WEBHOOK_PATH.exec(u.pathname);
  if (!m) return null;
  if (m[3] && !opts.target) return null;
  const big = BigInt(m[1]);
  // A snowflake is a positive 64-bit integer.
  if (big === BigInt(0) || big > MAX_SNOWFLAKE) return null;
  const id = big.toString();
  const url = `https://discord.com/api/webhooks/${id}/${m[2]}`;
  return { id, token: m[2], url, requestUrl: `${url}${m[3] ?? ''}${opts.target ? u.search : ''}` };
}

/** The normalized form of a webhook URL, or null when it doesn't normalize cleanly. Store this. */
export function normalizeDiscordWebhookUrl(raw: string): string | null {
  return parseDiscordWebhook(raw)?.url ?? null;
}

/**
 * A setting that holds several webhook URLs (space / comma / newline separated), normalized; or null
 * when any item is not a clean Discord webhook URL. Empty in, empty out.
 */
export function normalizeWebhookList(raw: string): string | null {
  const items = raw.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  for (const item of items) {
    const url = normalizeDiscordWebhookUrl(item);
    if (!url) return null;
    if (!out.includes(url)) out.push(url);
  }
  return out.join(' ');
}

/** Every webhook URL in a blob of text (a list setting, a JSON prefs column), parsed canonically. */
export function webhooksIn(text: string | null | undefined): ParsedWebhook[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: ParsedWebhook[] = [];
  for (const m of text.matchAll(/https:\/\/[^\s"'<>,\\]+/gi)) {
    const p = parseDiscordWebhook(m[0], { target: true });
    if (p && !seen.has(p.url)) {
      seen.add(p.url);
      out.push(p);
    }
  }
  return out;
}

export function isDiscordWebhookUrl(raw: string): boolean {
  return parseDiscordWebhook(raw) !== null;
}

/**
 * The looser check for the SENDERS, which also address a webhook's `/messages/<id>` for edits: the
 * host is Discord's and the path is under a webhook. Every server-side post goes through this, so a
 * URL that slipped past the save-time check — an old row, a route that never checked — still can
 * only ever reach Discord.
 */
export function isDiscordWebhookTarget(raw: string): boolean {
  return parseDiscordWebhook(raw, { target: true }) !== null;
}

/**
 * The one guarded way the server fetches a webhook URL somebody typed in: refused (null, nothing
 * fetched) unless it is a Discord webhook, and redirects are an error rather than followed, so a
 * vetted URL can never be bounced somewhere else. It fetches the NORMALIZED form, never the raw one.
 * `subpaths` allows the sender's `/messages/<id>` and query.
 */
export function fetchDiscordWebhook(
  raw: string,
  init: RequestInit = {},
  opts: { subpaths?: boolean } = {},
): Promise<Response> | null {
  const parsed = parseDiscordWebhook(raw, { target: !!opts.subpaths });
  if (!parsed) return null;
  return fetch(parsed.requestUrl, { ...init, redirect: 'error' });
}
