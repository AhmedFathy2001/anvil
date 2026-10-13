// A Discord server's public widget (`/api/guilds/<id>/widget.json`), fetched and cached.
//
// The widget is the only presence data Discord gives without a gateway connection (see
// discord-no-gateway-no-joins): who is online, idle or busy, who is in which voice channel, and what
// game each person's Discord shows. It is PUBLIC by Discord's own design — anybody with the server id
// can read it — but it only exists while the server's admins have "Enable Server Widget" on, and it
// lists at most 100 members.
//
// Pure apart from `fetch`: no database, so the clan hall merge and its tests can import it.

export interface WidgetMember {
  /** Discord's per-response index ("0", "1", …), NOT a user id — the widget withholds those. */
  id: string;
  /** The name the server shows: the member's nickname when they have one. */
  username: string;
  status: 'online' | 'idle' | 'dnd';
  avatarUrl: string | null;
  /** The game Discord shows them playing, e.g. "RuneLite". */
  game: string | null;
  /** The voice channel they are in, when the widget lists it. */
  channelId: string | null;
}

export interface WidgetChannel {
  id: string;
  name: string;
  position: number;
}

export interface GuildWidget {
  guildId: string;
  name: string;
  /** Discord's own invite, present only when the server picked an invite channel in Widget settings. */
  instantInvite: string | null;
  presenceCount: number;
  members: WidgetMember[];
  channels: WidgetChannel[];
}

export type WidgetResult =
  | { ok: true; widget: GuildWidget; fetchedAt: number }
  /** `disabled` = the server has its widget switched off; `unknown` = no such server. */
  | { ok: false; reason: 'disabled' | 'unknown' | 'unreachable'; fetchedAt: number };

const STATUSES = new Set(['online', 'idle', 'dnd']);

/** Shape Discord's JSON, dropping anything malformed rather than trusting it. */
export function parseWidget(guildId: string, raw: unknown): GuildWidget | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== 'string') return null;
  const members: WidgetMember[] = Array.isArray(r.members)
    ? r.members.flatMap((m): WidgetMember[] => {
        if (!m || typeof m !== 'object') return [];
        const o = m as Record<string, unknown>;
        if (typeof o.username !== 'string' || !o.username.trim()) return [];
        const status = typeof o.status === 'string' && STATUSES.has(o.status) ? (o.status as WidgetMember['status']) : 'online';
        const game = o.game && typeof o.game === 'object' && typeof (o.game as { name?: unknown }).name === 'string'
          ? ((o.game as { name: string }).name)
          : null;
        return [{
          id: String(o.id ?? ''),
          username: o.username.trim(),
          status,
          // Only Discord's own CDN: this lands in an <img src> on our pages.
          avatarUrl: typeof o.avatar_url === 'string' && o.avatar_url.startsWith('https://cdn.discordapp.com/') ? o.avatar_url : null,
          game,
          channelId: typeof o.channel_id === 'string' ? o.channel_id : null,
        }];
      })
    : [];
  const channels: WidgetChannel[] = Array.isArray(r.channels)
    ? r.channels.flatMap((c): WidgetChannel[] => {
        if (!c || typeof c !== 'object') return [];
        const o = c as Record<string, unknown>;
        if (typeof o.id !== 'string' || typeof o.name !== 'string') return [];
        return [{ id: o.id, name: o.name, position: typeof o.position === 'number' ? o.position : 0 }];
      })
    : [];
  channels.sort((a, b) => a.position - b.position);
  const invite = typeof r.instant_invite === 'string' && r.instant_invite.startsWith('https://discord.') ? r.instant_invite : null;
  return {
    guildId,
    name: r.name,
    instantInvite: invite,
    presenceCount: typeof r.presence_count === 'number' ? r.presence_count : members.length,
    members,
    channels,
  };
}

/** A guild id is a snowflake: digits only. Anything else never reaches Discord's URL. */
export function isSnowflake(id: string | null | undefined): id is string {
  return !!id && /^\d{15,22}$/.test(id);
}

// One request per guild per minute however many pages and embeds ask: the widget is read on every
// clan home view and by iframes on other people's sites, and Discord rate-limits by IP. A failure is
// kept for five minutes, so a server with its widget off is not asked again on every page view.
const OK_TTL = 60_000;
const FAIL_TTL = 5 * 60_000;
const CAP = 500;
const cache = new Map<string, { at: number; value: Promise<WidgetResult> }>();

export function fetchGuildWidget(guildId: string): Promise<WidgetResult> {
  const now = Date.now();
  const hit = cache.get(guildId);
  if (hit) {
    // Settled values are checked against their own TTL; an in-flight one is always shared.
    const fresh = hit.value.then((v) => now - v.fetchedAt < (v.ok ? OK_TTL : FAIL_TTL));
    return fresh.then((ok) => (ok ? hit.value : refresh(guildId)));
  }
  return refresh(guildId);
}

function refresh(guildId: string): Promise<WidgetResult> {
  const value = (async (): Promise<WidgetResult> => {
    const fetchedAt = Date.now();
    if (!isSnowflake(guildId)) return { ok: false, reason: 'unknown', fetchedAt };
    try {
      const res = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`, {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const body = await res.json().catch(() => null);
      // 50004 "Widget Disabled" (403); 10004 "Unknown Guild" (404).
      if (!res.ok) {
        const code = body && typeof body === 'object' ? (body as { code?: unknown }).code : null;
        return { ok: false, reason: code === 50004 ? 'disabled' : res.status === 404 || code === 10004 ? 'unknown' : 'unreachable', fetchedAt };
      }
      const widget = parseWidget(guildId, body);
      return widget ? { ok: true, widget, fetchedAt } : { ok: false, reason: 'unreachable', fetchedAt };
    } catch {
      return { ok: false, reason: 'unreachable', fetchedAt };
    }
  })();
  if (cache.size >= CAP) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(guildId, { at: Date.now(), value });
  return value;
}

/**
 * Anvil's own server (support + The AFK Spot), shown on the platform pages. Overridable so a
 * self-hosted deployment points it at its own server, or blanks it to show none.
 */
export function platformGuildId(): string | null {
  const env = process.env.ANVIL_DISCORD_GUILD_ID;
  if (env !== undefined) return isSnowflake(env.trim()) ? env.trim() : null;
  return '1324522160315961365';
}
