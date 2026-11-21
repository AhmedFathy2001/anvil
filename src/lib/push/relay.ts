import crypto from 'node:crypto';

import { checkBody } from '../eventChatRules.ts';

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Anvil chat: an opt-in copy of a player's own chat lines, relayed to other signed-in Anvil players
// in the same world, clan or channel and shown with the Anvil icon. Pure (the clock is injected), so it is tested directly
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
//   fc:<owner>  friends chat — the channel owner the plugin says it sits in (`?fc=`). Self-reported, like
//                        the world; each receiver shows a line only when the sender is in its OWN friends
//                        chat member list, so nobody's names are uploaded and a wrong room shows nothing.
//   guest:<clan> guest clan — the clan the plugin says it guests in (`?guest=`), checked the same way.
//   pm:<name>   private messages — every relay socket sits in its own character's room, so a PM
//                        ({"t":"say","c":"pm","to":name}) reaches only that character's sockets, if any,
//                        whatever channels the two share, and only as the recipient's own private chat
//                        setting lets it: On anyone, Friends their friends (their client checks), Off nobody.
// Presence ("here"/"gone") never says more than the game would: someone hiding as offline stays so.
// Clan, guest clan and friends chat rooms name their members (the game lists them to the channel). A
// world room names nobody: it spans a whole world, and the game shows only the players around you.
// Past those channels, a player's own private chat setting decides. A plugin says its setting ({"t":"pm","m":
// "on"|"friends"|"off"}; until it does, PMs still reach it (its client filters them as ever) but nobody
// is told it is connected) and asks about names ({"t":"who","n":[names]}: its client asks
// only of players the game already shows it: on screen or online on its friends list). On: answered
// "here". Friends or Off: the named player's client is asked ({"t":"ask","n":asker}) and answers
// {"t":"ok","n":asker} only when the game shows it to the asker anyway: the asker is on its screen, or
// is its friend while it is on Friends. Not said (an older plugin): never answered. Who was told so hears "gone" when it leaves or tightens the setting.
// GIM is not relayed: Anvil keeps no GIM groups, and a group named by the client could be anyone's.
// Out, to the room minus the sender's own sockets:
//   {"t":"relay","c":…,"n":"Name","nm":"<img=2>Name","x":text,"xh":escaped,"at":ms,"u":user,"k":sig}
// Presence, to relay sockets only: {"t":"here","n":[names]} on joining (the others in its rooms) and to
// those others; {"t":"gone","n":name} when the last socket of that character leaves.
// `nm` is the name as the game writes it (account-type icon first); `u` the sender's Anvil user and
// `k` this server's signature of (u, n, c, at, x), so a report (api/plugin/chat-relay/report) can only
// be of a line this server really sent.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

export type RelayChannel = 'public' | 'clan' | 'fc' | 'guest' | 'pm';

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
  /** The friends chat owner it sits with (standardised), or null: the fc room. */
  fc?: string | null;
  /** The guest clan it sits in (standardised), or null: the guest room. */
  guest?: string | null;
  /**
   * That guest clan's id, when it is a clan on Anvil (matched by its in-game name). Its guests and its
   * members are in ONE in-game channel, so the two rooms are joined up: see `across`.
   */
  guestClanId?: number | null;
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
  /** Its own private chat setting; null until the plugin says (an older plugin never does). */
  pm: PmMode | null;
  /** Who it has been shown to outside shared rooms: told when it goes. */
  seenBy: Set<Member>;
  /** Who asked about it while it is on Friends, waiting for its client's answer. */
  asked: Set<Member>;
  /** When it last asked about names, for the limit. */
  whoAt: number[];
}

export type PmMode = 'on' | 'friends' | 'off';
/** Names a plugin may ask about per window: a friends list's worth opening menus, not a sweep. */
export const WHO_BURST = 40;

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
    const m: Member = { client, rooms: new Set(), sent: [], last: new Map(), pm: null, seenBy: new Set(), asked: new Set(), whoAt: [] };
    this.members.set(client, m);
    if (client.who.clanId != null) this.join(m, `clan:${client.who.clanId}`);
    // A world holds 2,000 players; a room far past that is somebody's script, not a world.
    const w = client.who.world;
    if (w != null && w > 0 && w < 10_000 && this.roomSize(`world:${w}`) < WORLD_MAX) this.join(m, `world:${w}`);
    const fc = fcOwner(client.who.fc);
    if (fc) this.join(m, `fc:${fc}`);
    const guest = fcOwner(client.who.guest);
    // A guest of a clan that is on Anvil sits in that clan's guest room by ID, which is what lets the
    // clan's members and its guests hear each other; any other guest clan is a room by name.
    if (guest) this.join(m, client.who.guestClanId != null ? `gclan:${client.who.guestClanId}` : `guest:${guest}`);
    this.join(m, `pm:${presenceName(client.who.name)}`);
    // Presence: who else in these rooms has the relay on (they opted in; nobody else is ever named),
    // and to each of them, that this character is here now.
    const me = presenceName(client.who.name);
    const here = new Set<string>();
    for (const o of this.around(m)) {
      const name = presenceName(o.client.who.name);
      if (name !== me) {
        here.add(name);
        o.client.send(JSON.stringify({ t: 'here', n: [me] }));
      }
    }
    if (here.size) client.send(JSON.stringify({ t: 'here', n: [...here] }));
    return () => {
      const around = this.around(m);
      for (const o of m.seenBy) if (this.members.has(o.client)) around.add(o);
      for (const r of [...m.rooms]) this.leave(m, r);
      this.members.delete(client);
      for (const o of this.members.values()) {
        o.seenBy.delete(m);
        o.asked.delete(m);
      }
      // Gone only once no socket of this character is left beside them (a re-ticket opens its new one first).
      for (const o of around) {
        if (presenceName(o.client.who.name) === me) return;
      }
      for (const o of around) o.client.send(JSON.stringify({ t: 'gone', n: me }));
    };
  }

  /** Everyone sharing a channel with this member (not just a world), once each, itself left out. */
  private around(m: Member): Set<Member> {
    const out = new Set<Member>();
    for (const r of m.rooms) if (!r.startsWith('world:')) for (const side of [r, across(r)]) for (const o of (side ? this.rooms.get(side) : null) ?? []) if (o !== m) out.add(o);
    return out;
  }

  /** One message from a plugin. The reason when it went nowhere (for tests and the log), else null. */
  receive(client: RelayClient, raw: unknown): string | null {
    const m = this.members.get(client);
    if (!m || !raw || typeof raw !== 'object') return 'bad';
    const msg = raw as Record<string, unknown>;
    if (msg.t === 'pm') return this.setPm(m, msg.m);
    if (msg.t === 'who') return this.who(m, msg.n);
    if (msg.t === 'ok') return this.ok(m, msg.n);
    if (msg.t !== 'say') return 'bad';
    return this.say(m, msg.c, msg.x, msg.to);
  }

  /** Its private chat setting. Tightened, whoever it was shown to past a shared channel hears it is gone. */
  private setPm(m: Member, mode: unknown): string | null {
    if (mode !== 'on' && mode !== 'friends' && mode !== 'off') return 'bad';
    const was = m.pm;
    m.pm = mode;
    if (mode === was || mode === 'on') return null;
    m.asked.clear();
    const me = presenceName(m.client.who.name);
    const shared = this.around(m);
    for (const o of m.seenBy) if (!shared.has(o)) o.client.send(JSON.stringify({ t: 'gone', n: me }));
    m.seenBy.clear();
    return null;
  }

  /** Names it wants to know about: answered as each one's private chat setting allows. */
  private who(m: Member, names: unknown): string | null {
    if (!Array.isArray(names)) return 'bad';
    const at = this.now();
    m.whoAt = m.whoAt.filter((t) => t > at - RELAY_WINDOW_MS);
    const asker = presenceName(m.client.who.name);
    const shared = this.around(m);
    for (const raw of names) {
      if (m.whoAt.length >= WHO_BURST) return 'rate';
      if (typeof raw !== 'string' || raw.length > 20) continue;
      m.whoAt.push(at);
      const name = presenceName(raw);
      if (!name || name === asker) continue;
      for (const o of this.rooms.get(`pm:${name}`) ?? []) {
        if (shared.has(o)) m.client.send(JSON.stringify({ t: 'here', n: [name] }));
        else if (o.pm === 'on') this.show(o, m);
        else if (o.pm != null && !o.asked.has(m)) {
          o.asked.add(m);
          o.client.send(JSON.stringify({ t: 'ask', n: asker }));
        }
      }
    }
    return null;
  }

  /** Its client's answer: the game shows it to that asker anyway. Only an open question is answered. */
  private ok(m: Member, name: unknown): string | null {
    if (typeof name !== 'string') return 'bad';
    const want = presenceName(name);
    for (const o of [...m.asked]) {
      if (presenceName(o.client.who.name) !== want) continue;
      m.asked.delete(o);
      if (this.members.has(o.client)) this.show(m, o);
    }
    return null;
  }

  /** Tell `to` that `m` is connected, and remember to tell it when that stops. */
  private show(m: Member, to: Member): void {
    if (m === to) return;
    m.seenBy.add(to);
    to.client.send(JSON.stringify({ t: 'here', n: [presenceName(m.client.who.name)] }));
  }

  private say(m: Member, c: unknown, x: unknown, to: unknown): string | null {
    if (!this.enabled) return 'off';
    if (c !== 'public' && c !== 'clan' && c !== 'fc' && c !== 'guest' && c !== 'pm') return 'bad';
    if (typeof x !== 'string' || x.length > RELAY_MAX * 2) return 'bad';
    // A PM's room is its recipient's own (only if they have a relay socket); the rest, the sender's.
    const room = c === 'pm' ? (typeof to === 'string' && [...(this.rooms.get(`pm:${presenceName(to)}`) ?? [])].some((o) => o.pm !== 'off') ? `pm:${presenceName(to)}` : null)
      : [...m.rooms].find((r) => (c === 'guest' ? r.startsWith('guest:') || r.startsWith('gclan:') : r.startsWith(c === 'public' ? 'world:' : `${c}:`)));
    if (!room) return 'no-room';
    // Event chat's own filter: no links, no gold adverts, no markup (lib/eventChatRules checkBody).
    const raw = checkBody(x, { staff: false, keepRuns: true });
    if (!raw.ok || raw.body.length > RELAY_MAX) return 'filtered';
    // The game capitalises public, friends chat and private lines itself; a clan or guest clan line is
    // capitalised here so Anvil chat reads the same.
    const checked = { body: c === 'clan' || c === 'guest' ? raw.body.charAt(0).toUpperCase() + raw.body.slice(1) : raw.body };
    const at = this.now();
    m.sent = m.sent.filter((t) => t > at - RELAY_WINDOW_MS);
    if (m.sent.length >= RELAY_BURST) return 'rate';
    const repeat = `${c}|${checked.body.toLowerCase()}`;
    const was = m.last.get(repeat);
    if (was != null && at - was < RELAY_REPEAT_MS) return 'repeat';
    for (const [k, t] of m.last) if (at - t >= RELAY_REPEAT_MS) m.last.delete(k);
    m.last.set(repeat, at);
    m.sent.push(at);
    const who = m.client.who;
    const line = (c: string) => JSON.stringify({
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
    const text = line(c);
    for (const o of this.rooms.get(room) ?? []) {
      if (o === m || o.client.who.name === who.name || (c === 'pm' && o.pm === 'off')) continue;
      o.client.send(text);
      // Whoever PMs someone has shown themselves to them: the recipient can reply.
      if (c === 'pm') this.show(m, o);
    }
    // The same in-game channel from the other side: a member's clan line is a guest clan line to the
    // clan's guests, and a guest's line is a clan line to its members. Sent (and signed) as the
    // channel the reader is in, which is the one their client checks the sender against.
    const other = across(room);
    if (other && this.rooms.has(other)) {
      const flipped = line(c === 'clan' ? 'guest' : 'clan');
      for (const o of this.rooms.get(other) ?? []) if (o !== m && o.client.who.name !== who.name) o.client.send(flipped);
    }
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

/** A clan's member room and its guest room are one in-game channel: each one's other side, else null. */
function across(room: string): string | null {
  if (room.startsWith('clan:')) return `gclan:${room.slice(5)}`;
  if (room.startsWith('gclan:')) return `clan:${room.slice(6)}`;
  return null;
}

/** A friends chat owner or a clan name as a room key: name characters, lower case; null when it can't be one. */
export function fcOwner(raw: unknown): string | null {
  const v = typeof raw === 'string' ? raw.replace(/\u00a0/g, ' ').trim().toLowerCase() : '';
  return /^[a-z0-9 _-]{1,20}$/.test(v) ? v : null;
}

/** A character's name as presence carries it: plain, lower case, single spaces (the plugin's Text.standardize). */
export function presenceName(name: string): string {
  return name.replace(/\u00a0/g, ' ').replace(/[\s_-]+/g, ' ').trim().toLowerCase();
}
