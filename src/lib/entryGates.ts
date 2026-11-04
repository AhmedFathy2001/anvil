// Creator entry gates — the rules. Pure: no database import (tests/pure-module-imports).
//
// A creator space's event can say WHO may join: the host's Twitch followers, their subscribers at a
// tier or above, people with a role in the host's Discord server, or that server's boosters. Only
// creator spaces (lib/creatorSpaces) — a clan already decides entry through its roster.
//
// ANY-OF. A host who ticks "Followers" and "Discord role" means "my community", and somebody in
// either is part of it. All-of would be a strange thing to want (a sub who never pressed Follow
// would be turned away) and the UI says "any one is enough" next to the choices.
//
// FAIL CLOSED. A rule that cannot be checked (Twitch down, the host's link revoked) never lets
// anyone through; the viewer is told what is wrong and whose move it is. An outage is never cached,
// so pressing Join again after it clears just works.
//
// The checker takes a PROBE — the three external questions it may ask, each memoised and only asked
// when a rule needs it — so the orchestration is tested here without a database or the network, and
// lib/entryGatesDb supplies the real one.
//
// KICK lives in lib/gates/kick (its rules, words and the answer shape); this file only routes to it.

import { isKickKind, kickRuleLabel, kickRuleOutcome, type KickAnswer, type KickRule } from '@/lib/gates/kick';

import { isYoutubeRule, youtubeRuleLabel, youtubeStep, type YoutubeAnswer } from '@/lib/gates/youtube';

// ── The model ────────────────────────────────────────────────────────────────────────────────────

export type SubTier = 1 | 2 | 3;

export type GateRule =
  | { kind: 'twitch-follow' }
  | { kind: 'twitch-sub'; tier: SubTier }
  | { kind: 'discord-role'; roleId: string; roleName: string }
  | { kind: 'discord-booster' }
  // YouTube (lib/gates/youtube): a subscriber, or a channel member seen in the host's live chat.
  | { kind: 'youtube-sub' }
  | { kind: 'youtube-member' }
  | KickRule;

export type GateKind = GateRule['kind'];

export interface EntryGates {
  anyOf: GateRule[];
}

/** The most Discord roles one event may name. Bounded so a hand-crafted body cannot grow a row. */
export const MAX_GATE_ROLES = 5;

const SNOWFLAKE = /^\d{15,22}$/;

export function isTwitchRule(r: GateRule): boolean {
  return r.kind === 'twitch-follow' || r.kind === 'twitch-sub';
}

export function isKickRule(r: GateRule): r is KickRule {
  return isKickKind(r.kind);
}

export function isDiscordRule(r: GateRule): boolean {
  return r.kind === 'discord-role' || r.kind === 'discord-booster';
}

/** A role name for display only: trimmed, no control characters, no leading @, at most 100 chars. */
function cleanRoleName(v: unknown): string {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .replace(/^@+/, '')
    .trim()
    .slice(0, 100);
}

/**
 * Read gates from a stored column or a request body, keeping only what the checker understands.
 *
 * Accepts a JSON string or an object. One follow rule, one sub rule (the LOWEST tier asked for wins
 * — it is the more permissive and any-of means the stricter one adds nothing), up to MAX_GATE_ROLES
 * distinct roles, one booster rule. Nothing left → null, which means "anyone".
 */
export function parseGates(raw: unknown): EntryGates | null {
  let v: unknown = raw;
  if (typeof v === 'string') {
    if (!v.trim()) return null;
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object') return null;
  const list = (v as { anyOf?: unknown }).anyOf;
  if (!Array.isArray(list)) return null;

  let follow = false;
  let subTier: SubTier | null = null;
  let booster = false;
  let ytSub = false;
  let ytMember = false;
  const kick = new Set<KickRule['kind']>();
  const roles = new Map<string, string>();
  for (const item of list.slice(0, 32)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    switch (r.kind) {
      case 'twitch-follow':
        follow = true;
        break;
      case 'twitch-sub': {
        const t = Number(r.tier);
        if (t === 1 || t === 2 || t === 3) subTier = subTier == null ? t : (Math.min(subTier, t) as SubTier);
        break;
      }
      case 'discord-role': {
        const id = typeof r.roleId === 'string' ? r.roleId.trim() : '';
        if (!SNOWFLAKE.test(id) || roles.has(id) || roles.size >= MAX_GATE_ROLES) break;
        roles.set(id, cleanRoleName(r.roleName) || 'a role');
        break;
      }
      case 'discord-booster':
        booster = true;
        break;
      case 'youtube-sub':
        ytSub = true;
        break;
      case 'youtube-member':
        ytMember = true;
        break;
      case 'kick-follow':
      case 'kick-sub':
        kick.add(r.kind);
        break;
    }
  }

  const anyOf: GateRule[] = [];
  if (follow) anyOf.push({ kind: 'twitch-follow' });
  if (subTier != null) anyOf.push({ kind: 'twitch-sub', tier: subTier });
  for (const [roleId, roleName] of roles) anyOf.push({ kind: 'discord-role', roleId, roleName });
  if (booster) anyOf.push({ kind: 'discord-booster' });
  if (ytSub) anyOf.push({ kind: 'youtube-sub' });
  if (ytMember) anyOf.push({ kind: 'youtube-member' });
  for (const k of ['kick-follow', 'kick-sub'] as const) if (kick.has(k)) anyOf.push({ kind: k });
  return anyOf.length > 0 ? { anyOf } : null;
}

/** The column value for these gates (null = anyone). Always the sanitized form. */
export function serializeGates(gates: EntryGates | null): string | null {
  const clean = gates ? parseGates(gates) : null;
  return clean ? JSON.stringify(clean) : null;
}

/** Only creator spaces honour gates; on any other host the column is ignored. */
export function gatesApply(clanKind: string | null | undefined, gates: EntryGates | null): gates is EntryGates {
  return clanKind === 'creator' && gates != null && gates.anyOf.length > 0;
}

// ── What a host can offer ───────────────────────────────────────────────────────────────────────

export interface HostChannelInfo {
  login: string;
  /** Affiliate or partner — the only channels a sub gate can work for. */
  canHaveSubs: boolean;
  /** Twitch refused the token; the host must connect again. */
  broken: boolean;
}

export interface GateOptions {
  twitch: {
    /** TWITCH_* env present. False → every Twitch option is hidden. */
    configured: boolean;
    channel: HostChannelInfo | null;
    /** Where "Connect your Twitch channel" goes (the client appends &return=<its path>). */
    connectUrl: string | null;
  };
  discord: {
    /** The bot is in a verified server for this space. */
    connected: boolean;
    roles: { id: string; name: string }[];
  };
  /**
   * The plan a stream-platform gate (any kind but discord-*) needs, when this space's plan does not
   * reach it; null/absent = allowed (lib/creatorPlans streamGateLock). Always null while
   * FREEMIUM_ENFORCED is off.
   */
  streamLock?: string | null;
  /** Absent on servers without YouTube configured (and in older callers). */
  youtube?: {
    configured: boolean;
    channel: { title: string; broken: boolean } | null;
    connectUrl: string | null;
  };
  /** Absent on servers without Kick configured (lib/gates/kickDb kickGateOptions). */
  kick?: KickGateOptions;
}

export interface KickGateOptions {
  configured: boolean;
  channel: { slug: string; broken: boolean; followersOnlyChat: boolean } | null;
  connectUrl: string | null;
}

/**
 * Only gates this host can actually check right now: a Twitch rule needs Twitch configured and a
 * working channel (subs: an affiliate or partner one); a role must exist in their server. A rule the
 * host could not satisfy would lock everybody out, so it is refused rather than silently dropped.
 */
export function validateGatesFor(gates: EntryGates | null, opts: GateOptions): { ok: true } | { ok: false; error: string } {
  if (!gates) return { ok: true };
  if (opts.streamLock && gates.anyOf.some((r) => !r.kind.startsWith('discord-'))) {
    return { ok: false, error: `Twitch, Kick and YouTube checks are a ${opts.streamLock} feature. Discord checks are free.` };
  }
  for (const r of gates.anyOf) {
    if (isYoutubeRule(r)) {
      const yt = opts.youtube;
      if (!yt?.configured) return { ok: false, error: 'YouTube checks are not available on this server.' };
      if (!yt.channel || yt.channel.broken) return { ok: false, error: 'Connect your YouTube channel first.' };
    } else if (isKickRule(r)) {
      if (!opts.kick?.configured) return { ok: false, error: 'Kick checks are not available on this server.' };
      if (!opts.kick.channel || opts.kick.channel.broken) return { ok: false, error: 'Connect your Kick channel first.' };
    } else if (isTwitchRule(r)) {
      if (!opts.twitch.configured) return { ok: false, error: 'Twitch checks are not available on this server.' };
      if (!opts.twitch.channel || opts.twitch.channel.broken) return { ok: false, error: 'Connect your Twitch channel first.' };
      if (r.kind === 'twitch-sub' && !opts.twitch.channel.canHaveSubs) {
        return { ok: false, error: 'Your Twitch channel can’t have subscribers yet (affiliates and partners only).' };
      }
    } else {
      if (!opts.discord.connected) return { ok: false, error: 'Connect your Discord server first.' };
      if (r.kind === 'discord-role' && !opts.discord.roles.some((x) => x.id === r.roleId)) {
        return { ok: false, error: 'That role is not in your Discord server.' };
      }
    }
  }
  return { ok: true };
}

// ── Words ────────────────────────────────────────────────────────────────────────────────────────

export interface GateContext {
  /** The host's Twitch channel name, when one is connected. */
  twitchLogin: string | null;
  /** The host's display name, for "<name>'s Discord server". */
  hostName: string;
  /** The host's YouTube channel title, when one is connected. */
  youtubeTitle?: string | null;
  /** The host's Kick channel slug, when one is connected. */
  kickSlug?: string | null;
}

function channel(ctx: GateContext): string {
  return ctx.twitchLogin ?? 'the host';
}

function server(ctx: GateContext): string {
  return `${ctx.hostName}’s Discord server`;
}

/** Who a rule lets in, for the host's picker summary and the viewer's join card. */
export function ruleLabel(rule: GateRule, ctx: GateContext): string {
  switch (rule.kind) {
    case 'twitch-follow':
      return `followers of ${channel(ctx)} on Twitch`;
    case 'twitch-sub':
      return rule.tier === 1
        ? `subscribers of ${channel(ctx)} on Twitch`
        : `tier ${rule.tier}+ subscribers of ${channel(ctx)} on Twitch`;
    case 'discord-role':
      return `people with the ${rule.roleName} role in ${server(ctx)}`;
    case 'discord-booster':
      return `boosters of ${server(ctx)}`;
    case 'youtube-sub':
    case 'youtube-member':
      return youtubeRuleLabel(rule, ctx.youtubeTitle);
    case 'kick-follow':
    case 'kick-sub':
      return kickRuleLabel(rule, ctx);
  }
}

/** "Open to followers of x on Twitch or boosters of y." */
export function gatesSummary(gates: EntryGates, ctx: GateContext): string {
  const labels = gates.anyOf.map((r) => ruleLabel(r, ctx));
  return `Open to ${joinOr(labels)}.`;
}

/**
 * Who a rule lets in, in a few words — for a list row or an in-game panel line where the full
 * sentence will not fit ("Subs (Twitch)", "Followers (Kick)", "Discord role: Raiders", "Boosters").
 * No host names: the line sits under the event's own title, which already says whose it is.
 */
export function ruleShortLabel(rule: GateRule): string {
  switch (rule.kind) {
    case 'twitch-follow':
      return 'Followers (Twitch)';
    case 'twitch-sub':
      return rule.tier === 1 ? 'Subs (Twitch)' : `Tier ${rule.tier}+ subs (Twitch)`;
    case 'discord-role':
      return `Discord role: ${(rule.roleName || 'a role').slice(0, 32)}`;
    case 'discord-booster':
      return 'Boosters';
    case 'youtube-sub':
      return 'Subscribers (YouTube)';
    case 'youtube-member':
      return 'Members (YouTube)';
    case 'kick-follow':
      return 'Followers (Kick)';
    case 'kick-sub':
      return 'Subs (Kick)';
  }
}

/**
 * The whole gate in a few words: "Subs only (Twitch)" for a lone sub rule, else the rules joined with
 * "or" ("Followers (Kick) or Boosters"). Null when nothing gates the event. Past three rules the rest
 * become "+N more" so a panel line stays a line.
 */
export function gatesShortLabel(gates: EntryGates | null | undefined): string | null {
  const rules = gates?.anyOf ?? [];
  if (rules.length === 0) return null;
  if (rules.length === 1) {
    const only = rules[0];
    if (only.kind === 'twitch-sub' && only.tier === 1) return 'Subs only (Twitch)';
    if (only.kind === 'kick-sub') return 'Subs only (Kick)';
    return ruleShortLabel(only);
  }
  const shown = rules.slice(0, 3).map(ruleShortLabel);
  const more = rules.length - shown.length;
  return more > 0 ? `${shown.join(', ')} +${more} more` : joinOr(shown);
}

function joinOr(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

// ── Checking ─────────────────────────────────────────────────────────────────────────────────────

/** Why a Twitch question could not be answered. */
export type TwitchUnknown =
  /** TWITCH_* env not set on this server. */
  | 'off'
  /** The host has not connected their channel, or Twitch refused its token. */
  | 'host-missing'
  /** The viewer has not linked a Twitch account. */
  | 'viewer-unlinked'
  /** Twitch did not answer (network, 5xx, rate limit). Never cached. */
  | 'error';

export type TwitchAnswer<T> = { state: 'ok'; value: T } | { state: TwitchUnknown };

export type DiscordAnswer =
  | { state: 'ok'; member: false }
  | { state: 'ok'; member: true; roles: string[]; boosting: boolean }
  /** The viewer's login carries no real Discord id. */
  | { state: 'no-discord' }
  /** The host has no Discord server connected (or the bot is not in it). */
  | { state: 'no-server' }
  | { state: 'error' };

/** The external questions, each asked at most once per check and only when a rule needs it. */
export interface GateProbe {
  twitchFollows(): Promise<TwitchAnswer<boolean>>;
  /** 0 = not subscribed. */
  twitchSubTier(): Promise<TwitchAnswer<0 | SubTier>>;
  discordMember(): Promise<DiscordAnswer>;
  /** YouTube proofs on file (lib/gates/youtubeDb). Absent → treated as not configured. */
  youtubeSub?(): Promise<YoutubeAnswer>;
  youtubeMember?(): Promise<YoutubeAnswer>;
  /** What Kick has told Anvil about this viewer in the host's channel. Absent → Kick is off. */
  kickFacts?(): Promise<KickAnswer>;
}

export type GateVerdict =
  | { pass: true; via: GateKind }
  | {
      pass: false;
      /** Something could not be checked (an outage) — do not cache, let a retry ask again. */
      transient: boolean;
      /** "Open to …", for the top of the card. */
      summary: string;
      /** What the viewer can do, one line each, in rule order, de-duplicated. */
      steps: string[];
      /** A Twitch rule is waiting on the viewer linking Twitch: show the Link Twitch button. */
      linkTwitch: boolean;
      /** Nothing the viewer does with this account changes it (the Twitch account is spoken for). */
      blocked?: true;
      /** A YouTube rule wants the viewer to check their subscription (verify) or type their chat code. */
      youtube?: { verify?: true; chatCode?: true };
      /** A Kick rule wants a chat code from the viewer: show the "Get Kick code" button. */
      linkKick?: true;
    };

/** The Twitch account that passed the gate already got somebody else into this event. */
export const TWITCH_ALREADY_USED = 'That Twitch account was already used to join this event by another player.';

export function twitchAlreadyUsed(summary: string): Extract<GateVerdict, { pass: false }> {
  return { pass: false, transient: false, summary, steps: [TWITCH_ALREADY_USED], linkTwitch: false, blocked: true };
}

function memo<T>(fn: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | null = null;
  return () => (p ??= fn());
}

/**
 * Does this viewer pass any of the gates? Rules are tried in order and the first pass wins, so a
 * follower never costs a Discord call. Each failing rule contributes the step that would fix it.
 */
export async function checkGates(gates: EntryGates, probe: GateProbe, ctx: GateContext): Promise<GateVerdict> {
  const follows = memo(() => probe.twitchFollows().catch((): TwitchAnswer<boolean> => ({ state: 'error' })));
  const subTier = memo(() => probe.twitchSubTier().catch((): TwitchAnswer<0 | SubTier> => ({ state: 'error' })));
  const member = memo(() => probe.discordMember().catch((): DiscordAnswer => ({ state: 'error' })));
  const ytOff = async (): Promise<YoutubeAnswer> => ({ state: 'off' });
  const ytSub = memo(() => (probe.youtubeSub ?? ytOff)().catch((): YoutubeAnswer => ({ state: 'off' })));
  const ytMember = memo(() => (probe.youtubeMember ?? ytOff)().catch((): YoutubeAnswer => ({ state: 'off' })));
  let youtube: { verify?: true; chatCode?: true } | undefined;
  const kickFacts = memo(
    (): Promise<KickAnswer> => (probe.kickFacts ? probe.kickFacts().catch((): KickAnswer => ({ state: 'error' })) : Promise.resolve({ state: 'off' })),
  );
  let linkKick = false;

  const steps: string[] = [];
  let transient = false;
  let linkTwitch = false;
  const add = (s: string) => {
    if (!steps.includes(s)) steps.push(s);
  };
  const twitchUnknown = (state: TwitchUnknown) => {
    if (state === 'viewer-unlinked') {
      linkTwitch = true;
      add('Link your Twitch account');
    } else if (state === 'error') {
      transient = true;
      add('Twitch didn’t answer just now — try again in a minute');
    } else {
      add('The host’s Twitch connection isn’t working — let them know');
    }
  };
  const discordUnknown = (state: 'no-discord' | 'no-server' | 'error') => {
    if (state === 'error') {
      transient = true;
      add('Discord didn’t answer just now — try again in a minute');
    } else if (state === 'no-server') {
      add('The host’s Discord server isn’t connected — let them know');
    } else {
      add('Sign in to Anvil with your own Discord account');
    }
  };

  for (const rule of gates.anyOf) {
    switch (rule.kind) {
      case 'twitch-follow': {
        const a = await follows();
        if (a.state !== 'ok') twitchUnknown(a.state);
        else if (a.value) return { pass: true, via: rule.kind };
        else add(`Follow ${channel(ctx)} on Twitch`);
        break;
      }
      case 'twitch-sub': {
        const a = await subTier();
        if (a.state !== 'ok') twitchUnknown(a.state);
        else if (a.value >= rule.tier) return { pass: true, via: rule.kind };
        else if (a.value === 0) add(`Subscribe to ${channel(ctx)} on Twitch${rule.tier > 1 ? ` (tier ${rule.tier} or higher)` : ''}`);
        else add(`Upgrade your ${channel(ctx)} sub to tier ${rule.tier}`);
        break;
      }
      case 'discord-role':
      case 'discord-booster': {
        const a = await member();
        if (a.state !== 'ok') {
          discordUnknown(a.state);
          break;
        }
        if (!a.member) {
          add(`Join ${server(ctx)}`);
          break;
        }
        if (rule.kind === 'discord-role') {
          if (a.roles.includes(rule.roleId)) return { pass: true, via: rule.kind };
          add(`Get the ${rule.roleName} role in ${server(ctx)}`);
        } else {
          if (a.boosting) return { pass: true, via: rule.kind };
          add(`Boost ${server(ctx)}`);
        }
        break;
      }
      case 'youtube-sub':
      case 'youtube-member': {
        // Answers come from proofs already on file — no network here, so nothing is transient.
        const a = await (rule.kind === 'youtube-sub' ? ytSub() : ytMember());
        if (a.state === 'ok' && a.value) return { pass: true, via: rule.kind };
        const s = youtubeStep(rule, a, ctx.youtubeTitle);
        add(s.step);
        if (s.verify || s.chatCode) youtube = { ...youtube, ...(s.verify ? { verify: true } : {}), ...(s.chatCode ? { chatCode: true } : {}) };
        break;
      }
      case 'kick-follow':
      case 'kick-sub': {
        const o = kickRuleOutcome(rule, await kickFacts(), ctx);
        if (o.pass) return { pass: true, via: rule.kind };
        if (o.transient) transient = true;
        if (o.code) linkKick = true;
        add(o.step);
        break;
      }
    }
  }

  return {
    pass: false,
    transient,
    summary: gatesSummary(gates, ctx),
    steps,
    linkTwitch,
    ...(youtube ? { youtube } : {}),
    ...(linkKick ? { linkKick: true as const } : {}),
  };
}

/** One sentence for an API error body, where there is no room for a list. */
export function verdictMessage(v: Extract<GateVerdict, { pass: false }>): string {
  const first = v.steps[0];
  if (!first) return v.summary;
  if (v.blocked) return first;
  return v.transient ? `${v.summary} ${first}.` : `${v.summary} ${first}, then try again.`;
}

// ── Reading the platforms' answers ──────────────────────────────────────────────────────────────

/** Twitch's "1000" / "2000" / "3000" → 1 / 2 / 3. Prime subs are reported as "1000". */
export function twitchTierOf(raw: unknown): 0 | SubTier {
  const n = Number(raw);
  if (n >= 3000) return 3;
  if (n >= 2000) return 2;
  if (n >= 1000) return 1;
  return 0;
}

/** GET /guilds/{id}/members/{user} → what the gates need. Boosting is `premium_since` being set. */
export function discordMemberFacts(body: unknown): { roles: string[]; boosting: boolean } {
  const b = (body ?? {}) as { roles?: unknown; premium_since?: unknown };
  const roles = Array.isArray(b.roles) ? b.roles.filter((r): r is string => typeof r === 'string') : [];
  return { roles, boosting: typeof b.premium_since === 'string' && b.premium_since.length > 0 };
}

// ── The short cache ─────────────────────────────────────────────────────────────────────────────

/** A pass is good for ten minutes: long enough to absorb Join → sign-up, short enough to notice an unfollow. */
export const GATE_PASS_TTL_MS = 10 * 60_000;
/** A clean "no" is held for a few seconds only — just a double-click guard; they may be following right now. */
export const GATE_FAIL_TTL_MS = 10_000;

export function gateTtlMs(v: GateVerdict): number {
  if (v.pass) return GATE_PASS_TTL_MS;
  return v.transient ? 0 : GATE_FAIL_TTL_MS;
}

/**
 * Per-(user, event, gates) cache. The gates' JSON is part of the key, so a host changing who may
 * join takes effect at once. Process-local and bounded; losing it costs one extra API call.
 */
export class GateCache {
  private map = new Map<string, { until: number; verdict: GateVerdict }>();
  constructor(private readonly max = 5000) {}

  static key(userId: number, eventId: number, gates: EntryGates): string {
    return `${userId}:${eventId}:${JSON.stringify(gates)}`;
  }

  get(key: string, now = Date.now()): GateVerdict | null {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.until <= now) {
      this.map.delete(key);
      return null;
    }
    return hit.verdict;
  }

  set(key: string, verdict: GateVerdict, now = Date.now()): void {
    const ttl = gateTtlMs(verdict);
    if (ttl <= 0) return;
    if (this.map.size >= this.max) {
      // Oldest insert first — Map iterates in insertion order.
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, { until: now + ttl, verdict });
  }

  /** Forget everything about one person — they just linked Twitch, so a cached "no" is stale. */
  forgetUser(userId: number): void {
    const prefix = `${userId}:`;
    for (const k of this.map.keys()) if (k.startsWith(prefix)) this.map.delete(k);
  }

  get size(): number {
    return this.map.size;
  }
}
