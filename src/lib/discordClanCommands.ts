// The clan-wide slash commands: /sotw, /botw, /eff, /coffer, /clog, /luck.
//
// These sit alongside /bingo (lib/discordCommands) but answer about the CLAN rather than one board,
// so they don't resolve an event — they need the clan and, for the personal views, who is asking.
// lib/discordCommands owns the protocol envelope (ephemeral + Share button, the branded footer) and
// calls these through CLAN_COMMANDS; everything here just builds embeds from the same server-side
// functions the website and the plugin already use, so a number can never disagree across surfaces.
//
// One of these WRITES: /coffer add|remove records a manual coffer adjustment. It is the bot's only
// write, and it is gated on the member's SITE role in this clan (treasurer/admin/owner in
// clan_staff) — never a Discord role — mirroring verifyFeeCollector exactly, because it is the same
// job: this is the clan's money and rank alone has never conferred it.

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { clanRoster, memberClog, weeklyCompetitions } from '@/db/schema';

import {
  EMBED_COLOR,
  LIMIT,
  clamp,
  code,
  field,
  statField,
  type DiscordEmbed,
} from '@/lib/discordEmbeds';
import { fmt, type DiscordDict } from '@/lib/discordI18n';
import { resolveInvoker, type ClanContext, type InvokerIdentity } from '@/lib/discordContext';

import { competitionImageUrl, itemIconUrl } from '@/lib/tileIcons';
import { getEffectiveParticipants } from '@/lib/weekly';
import { weeklyMetricLabel } from '@/lib/weeklyLabels';
import { weeklyUnit } from '@/lib/weeklyStage';
import { listMembers } from '@/lib/memberProfile';
import {
  clanHasCoffer,
  getCofferBalance,
  listCofferEntries,
  recordAdjustment,
  topDonors,
} from '@/lib/coffer';
import { cofferLine } from '@/lib/cofferFeedText';
import { formatGp } from '@/lib/adminEventsFormat';
import { clanGrant, type ClanGrant } from '@/lib/clanGrants';
import { atLeast } from '@/lib/clanRoles';
import { getLuckBoards, getMemberLuck } from '@/lib/clogLuckBoard';
import { formatCount, formatNet, formatOdds } from '@/lib/clogLuck';
import { guideCommand } from '@/lib/discordGuides';

const STATS_ICON = 'https://oldschool.runescape.wiki/images/Stats_icon.png';
const CLOG_ITEM_ID = 22711; // Collection log
const COINS_ITEM_ID = 995;

// ── Shared furniture ──────────────────────────────────────────────────────────────────────────────

/** Everything a clan command needs, resolved once by the dispatcher. */
export interface ClanCommandCtx {
  t: DiscordDict;
  clan: ClanContext;
  /** The invoker's identity in THIS clan. Null when Discord didn't give us a user (should not happen). */
  identity: InvokerIdentity | null;
  /** The chosen subcommand, for the commands that have them (/coffer). Null otherwise. */
  sub: string | null;
  options: Record<string, string | number | boolean>;
  /** The invoker's display name, for prose. */
  who: string;
  /** The resolved locale code the answer is in — for commands that read another dictionary in the
   *  same language (e.g. /guide reads the guide i18n). Matches `t`. */
  locale: string;
}

/**
 * What a clan command produces. `shareable` marks a read that may be posted to the channel with the
 * Share button; a write (or a bare sentence) is never shareable — re-running a coffer adjustment
 * from a button would move gp twice.
 */
export type ClanResult = { embeds: DiscordEmbed[]; shareable?: boolean } | { text: string };

export type ClanCommand = (ctx: ClanCommandCtx) => Promise<ClanResult>;

function authorOf(clan: ClanContext): DiscordEmbed['author'] {
  return { name: clamp(clan.name, LIMIT.author), url: clan.origin ?? undefined };
}

/** The provenance subtext: which clan answered. The clan analogue of contextLine (no event here). */
function clanLine(clan: ClanContext, extra?: string): string {
  return `-# ${[clan.name, extra].filter(Boolean).join(' · ')}`;
}

/** Discord's own relative timestamp, so it ticks in every reader's timezone. */
function relativeTs(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  return `<t:${Math.floor(ms / 1000)}:R>`;
}

function placeMark(index: number): string {
  return ['🥇', '🥈', '🥉'][index] ?? `${index + 1}.`;
}

function thumb(url: string | null | undefined): Pick<DiscordEmbed, 'thumbnail'> {
  return url ? { thumbnail: { url } } : {};
}

/** The site URL for a section, when the clan has a public origin. */
function pathUrl(clan: ClanContext, path: string): string | undefined {
  return clan.origin ? `${clan.origin}${path}` : undefined;
}

/**
 * Resolve who a personal command is ABOUT: the invoker by default, or the member named in a `member`
 * option. A USER option arrives as a Discord user id, so it re-runs the same clan-scoped resolution.
 */
async function resolveTarget(
  ctx: ClanCommandCtx,
): Promise<{ accountIds: number[]; primaryAccountId: number | null; rsn: string | null; who: string }> {
  const named = typeof ctx.options.member === 'string' ? ctx.options.member.trim() : '';
  if (named) {
    const other = await resolveInvoker(named, ctx.clan.clanId);
    return {
      accountIds: other.accountIds,
      primaryAccountId: other.primaryAccountId,
      rsn: other.rsn,
      who: other.rsn ?? other.displayName ?? 'That member',
    };
  }
  return {
    accountIds: ctx.identity?.accountIds ?? [],
    primaryAccountId: ctx.identity?.primaryAccountId ?? null,
    rsn: ctx.identity?.rsn ?? null,
    // Name the ACCOUNT (RSN), not the Discord handle — /clog and /luck are about a game account, and
    // "Drenvox mdps — collection log" reads truer than the asker's Discord name. Falls back to the
    // Discord name only when we don't know their RSN.
    who: ctx.identity?.rsn ?? ctx.who,
  };
}

// ── /sotw + /botw ─────────────────────────────────────────────────────────────────────────────────
//
// A clan can run a SOTW and a BOTW at once, and even more than one of a kind, so these list EVERY
// active competition of their type rather than picking one — one embed each, up to a sane cap.

/** A competition's ranked standings, keeping the account id so we can find the invoker in it. */
async function rankWeekly(competitionId: number) {
  const parts = await getEffectiveParticipants(competitionId);
  const ranked = parts
    .map((p) => ({
      rsn: p.rsn,
      accountId: p.accountId,
      gained: (p.currentValue ?? 0) - (p.baselineValue ?? 0),
    }))
    .sort((a, b) => b.gained - a.gained || a.rsn.localeCompare(b.rsn));
  // A member holding two seats would otherwise appear twice; keep their best line only.
  const seen = new Set<string>();
  return ranked.filter((e) => {
    const key = e.rsn.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function weeklyResult(ctx: ClanCommandCtx, kind: 'skill' | 'boss'): Promise<ClanResult> {
  const { t, clan, identity } = ctx;
  const comps = await db.query.weeklyCompetitions.findMany({
    where: and(
      eq(weeklyCompetitions.clanId, clan.clanId),
      eq(weeklyCompetitions.status, 'active'),
      eq(weeklyCompetitions.type, kind),
    ),
  });
  if (comps.length === 0) {
    return { text: fmt(kind === 'skill' ? t.weekly.sotwEmpty : t.weekly.botwEmpty, { clan: clan.name }) };
  }

  const mine = new Set(identity?.accountIds ?? []);
  const embeds: DiscordEmbed[] = [];
  for (const c of comps.slice(0, 4)) {
    const board = await rankWeekly(c.id);
    const unit = weeklyUnit(c.type);
    const body: string[] = [];
    const ends = relativeTs(c.endDate);
    if (ends) body.push(fmt(t.weekly.ends, { when: ends }));

    if (board.length === 0) {
      body.push('', t.weekly.noEntries);
    } else {
      body.push(
        '',
        ...board
          .slice(0, 10)
          .map((e, i) => `${placeMark(i)} **${clamp(e.rsn, 40)}** — ${code(`${e.gained.toLocaleString()} ${unit}`)}`),
      );
      const idx = board.findIndex((e) => e.accountId != null && mine.has(e.accountId));
      body.push('', idx >= 0 ? fmt(t.weekly.you, { place: placeMark(idx), total: board.length }) : t.weekly.youNone);
    }
    body.push('', clanLine(clan));

    embeds.push({
      title: clamp(fmt(kind === 'skill' ? t.weekly.sotwTitle : t.weekly.botwTitle, { title: c.title }), LIMIT.title),
      url: pathUrl(clan, '/weekly'),
      description: clamp(body.join('\n'), LIMIT.description),
      color: EMBED_COLOR.gold,
      author: authorOf(clan),
      ...thumb(competitionImageUrl(c.type, c.metric)),
      fields: [
        field(t.weekly.fieldMetric, weeklyMetricLabel(c.type, c.metric)),
        statField(t.weekly.fieldEntries, board.length),
      ],
    });
  }
  return { embeds, shareable: true };
}

// ── /eff ────────────────────────────────────────────────────────────────────────────────────────

async function effResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan, identity } = ctx;
  const metric = ctx.options.metric === 'ehb' ? 'ehb' : 'ehp';
  const members = await listMembers(clan.clanId);
  const ranked = members
    .map((m) => ({ accountId: m.accountId, rsn: m.rsn, value: metric === 'ehb' ? m.ehb : m.ehp }))
    .filter((m): m is { accountId: number; rsn: string; value: number } => m.value != null && m.value > 0)
    .sort((a, b) => b.value - a.value);

  if (ranked.length === 0) return { text: t.eff.empty };

  const label = metric.toUpperCase();
  const mine = new Set(identity?.accountIds ?? []);
  const body: string[] = ranked
    .slice(0, 10)
    .map((m, i) => `${placeMark(i)} **${clamp(m.rsn, 40)}** — ${code(`${m.value.toFixed(1)} ${label}`)}`);
  const idx = ranked.findIndex((m) => mine.has(m.accountId));
  if (idx >= 0) body.push('', fmt(t.eff.you, { rank: idx + 1, total: ranked.length }));
  body.push('', clanLine(clan));

  return {
    embeds: [
      {
        title: clamp(fmt(t.eff.title, { metric: label }), LIMIT.title),
        url: pathUrl(clan, '/members'),
        description: clamp(body.join('\n'), LIMIT.description),
        color: EMBED_COLOR.blue,
        author: authorOf(clan),
        ...thumb(STATS_ICON),
        fields: [statField(t.eff.fieldRanked, ranked.length)],
      },
    ],
    shareable: true,
  };
}

// ── /coffer ───────────────────────────────────────────────────────────────────────────────────────

/** The exact rule verifyFeeCollector enforces on the web: treasurer or admin/owner, and NOT a
 *  board-scoped treasurer whose reach is one event. Rank alone (a moderator) is deliberately not it. */
export function canManageCoffer(grant: ClanGrant | null): boolean {
  if (!grant) return false;
  if (grant.role === 'treasurer' && grant.treasurerScope === 'assigned') return false;
  return grant.role === 'treasurer' || atLeast(grant.role, 'admin');
}

/** Parse a gp amount the friendly way: `5m`, `2.5b`, `500k`, or a plain number with commas. */
export function parseGpAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.trunc(raw) : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toLowerCase().replace(/,/g, '').replace(/gp$/, '').trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/);
  if (!m) return null;
  const mult = m[2] === 'b' ? 1e9 : m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1;
  const value = Number(m[1]) * mult;
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

async function cofferBalanceResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan } = ctx;
  if (!(await clanHasCoffer(clan.clanId))) {
    return { text: fmt(t.coffer.none, { clan: clan.name }) };
  }
  const [balance, donors, recent] = await Promise.all([
    getCofferBalance(clan.clanId),
    topDonors(clan.clanId, 5),
    listCofferEntries({ clanId: clan.clanId, limit: 5 }),
  ]);

  const body: string[] = [];
  if (donors.length) {
    body.push(
      t.coffer.donorsHeading,
      ...donors.map((d, i) => `${placeMark(i)} **${clamp(d.rsn, 40)}** — ${code(formatGp(d.total))}`),
    );
  }
  if (recent.length) {
    body.push('', t.coffer.recentHeading, ...recent.map((e) => `• ${clamp(cofferLine(e, null), 90)}`));
  }
  body.push('', clanLine(clan));

  return {
    embeds: [
      {
        title: clamp(fmt(t.coffer.title, { clan: clan.name }), LIMIT.title),
        url: pathUrl(clan, '/admin/coffer'),
        description: clamp(body.join('\n'), LIMIT.description),
        color: EMBED_COLOR.gold,
        author: authorOf(clan),
        ...thumb(itemIconUrl(COINS_ITEM_ID)),
        fields: [
          statField(t.coffer.available, formatGp(balance.available)),
          statField(t.coffer.reserved, formatGp(balance.reserved)),
          statField(t.coffer.pending, formatGp(balance.pending)),
        ],
      },
    ],
    shareable: true,
  };
}

async function cofferWriteResult(ctx: ClanCommandCtx, sign: 1 | -1): Promise<ClanResult> {
  const { t, clan, identity } = ctx;
  // The write is gated on a SITE role, which needs a site user. A roster-only member (never signed
  // in on the web) has no clan_staff row to check, so they cannot be authorised here.
  if (!identity?.userId) return { text: t.coffer.needAccount };
  const grant = await clanGrant(clan.clanId, identity.userId);
  if (!canManageCoffer(grant)) return { text: t.coffer.notStaff };

  const magnitude = parseGpAmount(ctx.options.amount);
  if (magnitude == null || magnitude <= 0) return { text: t.coffer.badAmount };
  if (magnitude > 100_000_000_000) return { text: t.coffer.outOfRange };
  const amount = magnitude * sign;

  const note = typeof ctx.options.note === 'string' ? ctx.options.note.slice(0, 500) : null;
  // recordAdjustment announces the movement to the coffer feed channel itself, so the runner gets a
  // private confirmation and the channel gets the standard post — no double announcement here.
  await recordAdjustment({ clanId: clan.clanId, amount, userId: identity.userId, note });
  const balance = await getCofferBalance(clan.clanId);
  return {
    text: fmt(sign > 0 ? t.coffer.added : t.coffer.removed, {
      amount: formatGp(magnitude),
      available: formatGp(balance.available),
    }),
  };
}

async function cofferResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  if (ctx.sub === 'add') return cofferWriteResult(ctx, 1);
  if (ctx.sub === 'remove') return cofferWriteResult(ctx, -1);
  return cofferBalanceResult(ctx);
}

// ── /clog ───────────────────────────────────────────────────────────────────────────────────────

/** The clan's synced collection logs, most slots first — the leaderboard and the rank source. */
async function topCollectors(clanId: number) {
  return db
    .select({
      accountId: memberClog.accountId,
      rsn: clanRoster.rsn,
      obtained: memberClog.obtained,
      total: memberClog.total,
    })
    .from(memberClog)
    .innerJoin(clanRoster, eq(memberClog.accountId, clanRoster.accountId))
    .where(and(eq(clanRoster.clanId, clanId), isNull(clanRoster.leftAt)))
    .orderBy(desc(memberClog.obtained));
}

async function clogResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan } = ctx;
  const target = await resolveTarget(ctx);
  const board = await topCollectors(clan.clanId);

  // A person can hold several accounts, only some synced. Show their BEST-synced one rather than the
  // primary — the primary might be the unsynced alt, which is what made a fully-synced main wrongly
  // read as "hasn't synced". The rest are noted so a multi-account member isn't misrepresented.
  const mine = new Set(target.accountIds);
  const synced = board.filter((b) => mine.has(b.accountId)).sort((a, b) => b.obtained - a.obtained);
  const header = synced[0];
  const subject = header?.rsn ?? target.who;

  const body: string[] = [];
  if (!header) {
    // None of their accounts are on the leaderboard, which only lists synced logs.
    body.push(fmt(t.clog.notSynced, { who: subject }));
  } else {
    const rank = board.findIndex((b) => b.accountId === header.accountId) + 1;
    body.push(fmt(t.clog.rankLine, { rank, total: board.length, clan: clan.name }));
    if (synced.length > 1) {
      body.push(fmt(t.clog.alsoSynced, { names: synced.slice(1).map((s) => clamp(s.rsn, 20)).join(', ') }));
    }
  }
  if (board.length) {
    body.push(
      '',
      t.clog.topHeading,
      ...board.slice(0, 5).map((b, i) => `${placeMark(i)} **${clamp(b.rsn, 40)}** — ${code(`${b.obtained}/${b.total}`)}`),
    );
  }
  body.push('', clanLine(clan));

  return {
    embeds: [
      {
        title: clamp(fmt(t.clog.title, { who: subject }), LIMIT.title),
        url: pathUrl(clan, '/members'),
        description: clamp(body.join('\n'), LIMIT.description),
        color: EMBED_COLOR.gold,
        author: authorOf(clan),
        ...thumb(itemIconUrl(CLOG_ITEM_ID)),
        fields: header
          ? [
              statField(t.clog.slots, `${header.obtained}/${header.total}`),
              statField(t.clog.collectors, board.length),
            ]
          : [statField(t.clog.collectors, board.length)],
      },
    ],
    shareable: true,
  };
}

// ── /luck ───────────────────────────────────────────────────────────────────────────────────────

function luckItemLine(itemName: string, obtained: number, expected: number, tail: number): string {
  const odds = formatOdds(tail);
  const count = formatCount(obtained, expected);
  return `• **${clamp(itemName, 40)}** — ${count}${odds ? ` (${odds})` : ''}`;
}

async function memberLuckResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan } = ctx;
  const target = await resolveTarget(ctx);
  // Try their accounts in order — primary first, then the rest — so a member whose primary is an
  // unsynced alt still gets the luck of the account that HAS a synced log, not "hasn't synced".
  const ordered = [
    ...(target.primaryAccountId != null ? [target.primaryAccountId] : []),
    ...target.accountIds.filter((a) => a !== target.primaryAccountId),
  ];
  let luck: Awaited<ReturnType<typeof getMemberLuck>> = null;
  for (const a of ordered) {
    luck = await getMemberLuck(a, clan.clanId, 5);
    if (luck) break;
  }
  if (!luck) return { text: fmt(t.luck.notSynced, { who: target.who }) };

  const body: string[] = [
    fmt(t.luck.totalLine, { net: formatNet(luck.total.net), items: luck.total.items }),
  ];
  if (luck.dry.length) {
    body.push(
      '',
      t.luck.dryHeading,
      ...luck.dry.map((d) => luckItemLine(d.itemName, d.obtained, d.expected, d.assessment.tail)),
    );
  }
  if (luck.spooned.length) {
    body.push(
      '',
      t.luck.spoonedHeading,
      ...luck.spooned.map((d) => luckItemLine(d.itemName, d.obtained, d.expected, d.assessment.tail)),
    );
  }
  body.push('', clanLine(clan));

  const face = luck.dry[0]?.itemId ?? luck.spooned[0]?.itemId ?? null;
  return {
    embeds: [
      {
        title: clamp(fmt(t.luck.memberTitle, { who: target.who }), LIMIT.title),
        url: pathUrl(clan, '/members'),
        description: clamp(body.join('\n'), LIMIT.description),
        color: luck.total.net < 0 ? EMBED_COLOR.blue : EMBED_COLOR.green,
        author: authorOf(clan),
        ...thumb(face != null ? itemIconUrl(face) : null),
      },
    ],
    shareable: true,
  };
}

async function clanLuckResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  const { t, clan } = ctx;
  const boards = await getLuckBoards(clan.clanId, 5);
  if (boards.dry.length === 0 && boards.spooned.length === 0) return { text: t.luck.emptyBoards };

  const body: string[] = [];
  if (boards.dry.length) {
    body.push(
      t.luck.dryHeading,
      ...boards.dry.map(
        (e) => `• **${clamp(e.rsn, 32)}** — ${clamp(e.itemName, 32)} ${formatCount(e.assessment.obtained, e.assessment.expected)}`,
      ),
    );
  }
  if (boards.spooned.length) {
    body.push(
      '',
      t.luck.spoonedHeading,
      ...boards.spooned.map(
        (e) => `• **${clamp(e.rsn, 32)}** — ${clamp(e.itemName, 32)} ${formatCount(e.assessment.obtained, e.assessment.expected)}`,
      ),
    );
  }
  body.push('', `-# ${fmt(t.luck.fromLogs, { n: boards.membersConsidered })}`, clanLine(clan));

  const face = boards.dry[0]?.itemId ?? boards.spooned[0]?.itemId ?? null;
  return {
    embeds: [
      {
        title: clamp(fmt(t.luck.boardsTitle, { clan: clan.name }), LIMIT.title),
        url: pathUrl(clan, '/members'),
        description: clamp(body.join('\n'), LIMIT.description),
        color: EMBED_COLOR.gold,
        author: authorOf(clan),
        ...thumb(face != null ? itemIconUrl(face) : null),
      },
    ],
    shareable: true,
  };
}

async function luckResult(ctx: ClanCommandCtx): Promise<ClanResult> {
  // A named member (or the invoker asking about themselves) gets the personal breakdown; the bare
  // command shows the clan's boards.
  const named = typeof ctx.options.member === 'string' && ctx.options.member.trim().length > 0;
  return named ? memberLuckResult(ctx) : clanLuckResult(ctx);
}

// ── Registry ────────────────────────────────────────────────────────────────────────────────────

export const CLAN_COMMANDS: Record<string, ClanCommand> = {
  sotw: (ctx) => weeklyResult(ctx, 'skill'),
  botw: (ctx) => weeklyResult(ctx, 'boss'),
  eff: effResult,
  coffer: cofferResult,
  clog: clogResult,
  luck: luckResult,
  guide: guideCommand,
};

/** Subcommands that WRITE — never re-run from a Share button, and never advertised as shareable. */
export const CLAN_WRITE_SUBS: Record<string, Set<string>> = {
  coffer: new Set(['add', 'remove']),
};

export const CLAN_COMMAND_NAMES = Object.keys(CLAN_COMMANDS);
