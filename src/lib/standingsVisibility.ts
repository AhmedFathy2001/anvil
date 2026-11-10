// The standings curtain: one rule, one answer, asked by every surface that shows progress.
//
// A host can hide the standings until the event ends, or until a time they pick (usually the start
// of the final week), so the race stays a race instead of a scoreboard everyone has already read.
// While the curtain is down a member still sees THEIR OWN team in full — board, tile progress,
// completions, points, submissions — and nothing that tells them how anyone else is doing. Staff
// see everything. Team names and rosters are not progress and are never hidden.
//
// PURE. No database here, so the decision can be unit-tested and so client components can import
// the types. Who the viewer IS (staff? which teams?) is resolved by lib/standingsAccess, which then
// asks this module; every surface goes through that pair rather than re-deriving the rule.

import { parseEventRules, type EventRules, type StandingsRule } from '@/lib/eventRules';

/** The columns the decision needs. `rules` may be the stored JSON or an already-parsed object. */
export interface StandingsEvent {
  rules: string | null | EventRules;
  endDate?: string | null;
  forceEndedAt?: string | null;
}

/** Who is looking. Null = signed out / unknown, which is the public. */
export interface StandingsViewer {
  /** Event admins, clan staff and platform staff — they always see everything. */
  staff: boolean;
  /** Teams in this event the viewer plays on, captains or holds a team-staff seat on. */
  teamIds: readonly number[];
}

/** What a surface may show this viewer. */
export type StandingsScope =
  | { hidden: false }
  | {
      hidden: true;
      /** When the curtain lifts (ISO), or null when it lifts at an end the event doesn't have yet. */
      revealAt: string | null;
      /** 'at-end' / 'at-date', for the wording of the notice. */
      mode: 'at-end' | 'at-date';
      /** The teams whose progress this viewer may still see — their own. Empty for the public. */
      ownTeamIds: ReadonlySet<number>;
    };

function ruleOf(event: StandingsEvent): StandingsRule {
  const rules = typeof event.rules === 'string' || event.rules == null ? parseEventRules(event.rules) : event.rules;
  return rules.standings;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

/** When the event really ended or ends: a force-end wins over the planned end. */
function effectiveEndMs(event: StandingsEvent): number | null {
  return ms(event.forceEndedAt) ?? ms(event.endDate);
}

/**
 * When the standings become public, as ISO — null when they are live (no curtain at all) or when the
 * curtain is 'at-end' on an event with no end date yet.
 *
 * An 'at-date' curtain also lifts at the end if that comes first: nothing about a finished event's
 * standings is worth keeping back, and payouts, the recap and Wrapped all need them.
 */
export function standingsRevealAt(event: StandingsEvent): string | null {
  const rule = ruleOf(event);
  if (rule.visibility === 'live') return null;
  const end = effectiveEndMs(event);
  if (rule.visibility === 'at-end') return end != null ? new Date(end).toISOString() : null;
  const at = ms(rule.revealAt);
  const lift = at != null && end != null ? Math.min(at, end) : (at ?? end);
  return lift != null ? new Date(lift).toISOString() : null;
}

/** Does this event have a curtain configured at all (whether or not it has lifted yet)? */
export function hasStandingsCurtain(event: StandingsEvent): boolean {
  return ruleOf(event).visibility !== 'live';
}

/**
 * Is the curtain down right now, for EVERYONE who isn't staff? The question shared surfaces ask —
 * a public page, a link card, a shared Discord channel, a cache keyed by event.
 */
export function standingsHidden(event: StandingsEvent, now: number = Date.now()): boolean {
  const rule = ruleOf(event);
  if (rule.visibility === 'live') return false;
  const end = effectiveEndMs(event);
  if (end != null && end <= now) return false;
  if (rule.visibility === 'at-end') return true;
  const at = ms(rule.revealAt);
  // A missing date can't happen after parse (it reads as 'at-end'), but fail closed if it does.
  return at == null || at > now;
}

/**
 * What THIS viewer may see. The one function a per-viewer surface asks.
 *
 * - Curtain up (live, or past the reveal): everything.
 * - Staff: everything, always.
 * - Anyone else: their own teams' progress only. The public's own-team set is empty.
 */
export function standingsHiddenFor(
  event: StandingsEvent,
  viewer: StandingsViewer | null,
  now: number = Date.now(),
): StandingsScope {
  if (!standingsHidden(event, now)) return { hidden: false };
  if (viewer?.staff) return { hidden: false };
  const rule = ruleOf(event);
  return {
    hidden: true,
    revealAt: standingsRevealAt(event),
    mode: rule.visibility === 'at-date' ? 'at-date' : 'at-end',
    ownTeamIds: new Set(viewer?.teamIds ?? []),
  };
}

/** May this scope see this team's progress? */
export function canSeeTeamProgress(scope: StandingsScope, teamId: number | null | undefined): boolean {
  if (!scope.hidden) return true;
  return teamId != null && scope.ownTeamIds.has(teamId);
}

/** Keep only the rows this scope may see. A no-op when the curtain is up. */
export function filterToVisibleTeams<T>(scope: StandingsScope, rows: T[], teamOf: (row: T) => number | null | undefined): T[] {
  if (!scope.hidden) return rows;
  return rows.filter((row) => canSeeTeamProgress(scope, teamOf(row)));
}

/** A serialisable copy of a hidden scope, for props and JSON. Null when nothing is hidden. */
export interface StandingsCurtainInfo {
  revealAt: string | null;
  mode: 'at-end' | 'at-date';
  ownTeamIds: number[];
}

export function curtainInfo(scope: StandingsScope): StandingsCurtainInfo | null {
  if (!scope.hidden) return null;
  return { revealAt: scope.revealAt, mode: scope.mode, ownTeamIds: [...scope.ownTeamIds] };
}

/**
 * The words for the notice where the leaderboard would be. `formatDate` renders the instant for
 * the surface (a browser's locale, a Discord timestamp tag, plain UTC in a plugin panel).
 */
export function standingsHiddenNotice(
  info: Pick<StandingsCurtainInfo, 'revealAt' | 'mode'>,
  formatDate: (iso: string) => string = (iso) => new Date(iso).toUTCString(),
): string {
  if (info.mode === 'at-date' && info.revealAt) return `Standings are hidden until ${formatDate(info.revealAt)}.`;
  return 'Standings are hidden until the end of the event.';
}

// ---- Discord ----------------------------------------------------------------------------------

/**
 * Post kinds that tell a reader how a team is doing — a drop, a completed tile, a cleared board, a
 * claimed bounty, a digest or halfway table, a month's champion. While the curtain is down none of
 * these may reach a SHARED channel (the host's, a co-host's, an event-wide extra hook). A team's
 * own hook may still hear about its own team. Everything else (reveals of tiles, the start, the
 * rules, the draft, sign-ups) is not progress and posts as normal.
 *
 * Strings, not lib/discordPostPolicy's type, so this module stays dependency-free; the policy
 * module's test pins the two together.
 */
export const PROGRESS_POST_KINDS: ReadonlySet<string> = new Set([
  'submissions',
  'submissionRemoved',
  'tileComplete',
  'teamWin',
  'claims',
  'digest',
  'halfway',
  'eventEnd',
  'monthlyChampion',
]);

/** Where a post may go while the curtain is down. */
export interface CurtainRoute {
  /** Host channel, co-host channels and whole-event extra hooks. */
  shared: boolean;
  /** Team-scoped extra hooks: only this team's (null = none at all). Ignored when `shared`. */
  teamOnly: number | null;
}

/**
 * The routing decision for one post. `hidden` is standingsHidden(event) at send time. A progress
 * post about one team (it carries `teamId`) may still go to that team's own hooks; a progress post
 * about everyone (a digest, a halfway table) goes nowhere.
 */
export function curtainRoute(
  post: string,
  teamId: number | null | undefined,
  hidden: boolean,
  // The post names a race tile another team still sees as a locked "?" (lib/raceHideAhead): it goes
  // to that team's own channel only, like a progress post behind the curtain.
  tileHiddenFromOthers = false,
): CurtainRoute {
  if ((!hidden && !tileHiddenFromOthers) || !PROGRESS_POST_KINDS.has(post)) return { shared: true, teamOnly: null };
  return { shared: false, teamOnly: teamId ?? null };
}
