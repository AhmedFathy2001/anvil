import crypto from 'node:crypto';

import { checkBody } from '../eventChatRules.ts';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Chat relay: a copy of a player's own public and clan chat lines, for Anvil players whose game
// doesn't show them (the sender is muted). Pure (the clock is injected), so it is tested directly
// (tests/chat-relay.test.ts); push/server.ts feeds it the sockets.
//
// The plugin never touches outgoing chat: it reads its OWN line as its client shows it and sends a
// copy here ({"t":"say","c":"public"|"clan","x":text}). It goes to one in-memory room, never a
// broadcast, and nothing is written anywhere. Both rooms come from the signed ticket, never from a
// socket message:
//   world:<n>   public — the world the plugin was on when it asked for the ticket (a hop re-tickets).
//                        Only the plugin can know it; what it opens is that world's public chat, which
//                        everybody standing there sees anyway.
//   clan:<id>   clan   — the character's in-game clan on Anvil's roster.
// GIM is not relayed: Anvil keeps no GIM groups, and a group named by the client could be anyone's.
// Out, to the room minus the sender's own sockets:
//   {"t":"relay","c":…,"n":"Name","nm":"<img=2>Name","x":text,"xh":escaped,"at":ms,"u":user,"k":sig}
// `nm` is the name as the game writes it (account-type icon first); `u` the sender's Anvil user and
// `k` this server's signature of (u, n, c, at, x), so a report (api/plugin/chat-relay/report) can only
// be of a line this server really sent.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type RelayChannel = 'public' | 'clan';

/** What a relay ticket says about its character (lib/push/ticket `relay`). */
export interface RelayIdentity {
  /** The character's name as the game shows it. */
  name: string;
  /** The game's chat icon for its account type (ironman 2, ultimate 3, …), or null. */
  icon: number | null;
  /** Its clan on Anvil's roster: the clan room. */
  clanId: number | null;
  /** The world it is on: the public room. */
  world: number | null;
}

export interface RelayClient {
  userId: number;
  who: RelayIdentity;
  send(message: string): void;
}

/** Lines per person per window: about what the game itself lets anyone type. */
export const RELAY_BURST = 6;
export const RELAY_WINDOW_MS = 10_000;
/** The same line again within this long is one line (a spam-click, a re-sent copy). */
export const RELAY_REPEAT_MS = 10_000;
/** The game's own cap on a chat line. */
export const RELAY_MAX = 80;
const WORLD_MAX = 1_000;

/** Game chat icon index by Anvil's account type (accounts.account_type). */
const ICONS: Record<string, number> = { ironman: 2, ultimate: 3, hardcore: 10, group: 41, hardcore_group: 42, unranked_group: 43 };

export function accountIcon(type: string | null | undefined): number | null {
  return type ? (ICONS[type] ?? null) : null;
}

/** The key a relayed line is signed with, from the site's shared secret under its own label. */
export function relayKey(sessionSecret: string): Buffer {
  return crypto.createHmac('sha256', sessionSecret).update('anvil-chat-relay:v1').digest();
}

/** The signature over everything a report later shows: sender, name, channel, time and words. */
export function signLine(key: Buffer, userId: number, n: string, c: string, x: string, at: number): string {
  return crypto.createHmac('sha256', key).update(JSON.stringify([userId, n, c, at, x])).digest('base64url').slice(0, 22);
}

/** Whether `k` is this server's signature of the line. */
export function lineSigned(key: Buffer, userId: number, n: string, c: string, x: string, at: number, k: unknown): boolean {
  if (typeof k !== 'string') return false;
  const want = Buffer.from(signLine(key, userId, n, c, x, at));
  const got = Buffer.from(k);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

interface Member {
  client: RelayClient;
  rooms: Set<string>;
  sent: number[];
  last: Map<string, number>;
}

export class RelayHub {
  private readonly key: Buffer;
  private readonly now: () => number;
  private readonly rooms = new Map<string, Set<Member>>();
  private readonly members = new Map<RelayClient, Member>();
  /** Staff's switch (platform setting chat_relay_enabled): off, nothing is relayed. */
  enabled = true;

  constructor(key: Buffer, now: () => number = Date.now) {
    this.key = key;
    this.now = now;
  }

  get size(): number {
    return this.members.size;
  }

  /** A relay socket opened: into its ticket's clan and world rooms. */
  add(client: RelayClient): () => void {
    const m: Member = { client, rooms: new Set(), sent: [], last: new Map() };
    this.members.set(client, m);
    if (client.who.clanId != null) this.join(m, `clan:${client.who.clanId}`);
    // A world holds 2,000 players; a room far past that is somebody's script, not a world.
    const w = client.who.world;
    if (w != null && w > 0 && w < 10_000 && this.roomSize(`world:${w}`) < WORLD_MAX) this.join(m, `world:${w}`);
    return () => {
      for (const r of m.rooms) this.leave(m, r);
      this.members.delete(client);
    };
  }

  /** One message from a plugin. The reason when it went nowhere (for tests and the log), else null. */
  receive(client: RelayClient, raw: unknown): string | null {
    const m = this.members.get(client);
    if (!m || !raw || typeof raw !== 'object') return 'bad';
    const msg = raw as Record<string, unknown>;
    if (msg.t !== 'say') return 'bad';
    return this.say(m, msg.c, msg.x);
  }

  private say(m: Member, c: unknown, x: unknown): string | null {
    if (!this.enabled) return 'off';
    if (c !== 'public' && c !== 'clan') return 'bad';
    if (typeof x !== 'string' || x.length > RELAY_MAX * 2) return 'bad';
    const room = [...m.rooms].find((r) => r.startsWith(c === 'public' ? 'world:' : 'clan:'));
    if (!room) return 'no-room';
    // Event chat's own filter: no links, no gold adverts, no markup (lib/eventChatRules checkBody).
    const checked = checkBody(x, { staff: false });
    if (!checked.ok || checked.body.length > RELAY_MAX) return 'filtered';
    const at = this.now();
    m.sent = m.sent.filter((t) => t > at - RELAY_WINDOW_MS);
    if (m.sent.length >= RELAY_BURST) return 'rate';
    const repeat = `${c}|${checked.body}`;
    const was = m.last.get(repeat);
    if (was != null && at - was < RELAY_REPEAT_MS) return 'repeat';
    for (const [k, t] of m.last) if (at - t >= RELAY_REPEAT_MS) m.last.delete(k);
    m.last.set(repeat, at);
    m.sent.push(at);
    const who = m.client.who;
    const text = JSON.stringify({
      t: 'relay',
      c,
      n: who.name,
      nm: (who.icon != null ? `<img=${who.icon}>` : '') + who.name.replace(/[<>]/g, ''),
      x: checked.body,
      at,
      // Escaped for the game's chat (a '<' would open a tag): what the plugin prints.
      xh: checked.body.replace(/[<>]/g, (ch) => (ch === '<' ? '<lt>' : '<gt>')),
      k: signLine(this.key, m.client.userId, who.name, c, checked.body, at),
      u: m.client.userId,
    });
    // Never back to the sending character (its own client already shows the line), but a person's OTHER
    // characters are other players in game: their clients get it like anyone's.
    for (const o of this.rooms.get(room) ?? []) if (o !== m && o.client.who.name !== who.name) o.client.send(text);
    return null;
  }

  private join(m: Member, room: string): void {
    let set = this.rooms.get(room);
    if (!set) this.rooms.set(room, (set = new Set()));
    set.add(m);
    m.rooms.add(room);
  }

  private leave(m: Member, room: string): void {
    const set = this.rooms.get(room);
    set?.delete(m);
    if (set?.size === 0) this.rooms.delete(room);
    m.rooms.delete(room);
  }

  /** Who is in a room, for tests. */
  roomSize(room: string): number {
    return this.rooms.get(room)?.size ?? 0;
  }
}
