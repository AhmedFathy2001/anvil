// Where a tile race's progress posts may go, and what a shared channel is told instead.
//
// Two settings decide it, and the send path (lib/discord sendEventBingoWebhook) asks this module
// for every event post:
//
//   A. Hidden standings (lib/standingsVisibility): nothing about progress reaches a SHARED channel
//      (the host's, a co-host's, an event-wide extra hook). A team's own hook still hears about its
//      own team. Start and end posts are not progress; the end is when the results show.
//   B. "Hide tiles past the next step" (lib/raceHideAhead), standings visible: a post naming a tile
//      some other team still sees as a locked "?" stays whole in the team's own hook, and the shared
//      channels get a step line instead ("<Team> completed step 3"), never the tile. Progress lines
//      ("made progress on step 3") are coalesced: one per team per step per window.
//
// On top of both, every shared post on a hide-ahead race goes through scrubHiddenTileNames, so a
// digest award, a reveal, or any post added later can't name a locked tile by accident.
//
// Pure (no `@/db`): the tests drive the whole matrix directly.

import { PROGRESS_POST_KINDS } from '@/lib/standingsVisibility';

/** What a shared channel is told in place of a post naming a hidden tile. */
export type StepPostKind = 'progress' | 'step' | 'finish';

/**
 * The step line a post turns into, or null when it has none (it then stays in the team's own hook
 * only). `refKind` is the post's lib/discordPosts ref kind: it tells a completing submission from a
 * plain one, and a real tile completion from a correction or a combo part (which carry no ref).
 * `step` is 0-based.
 */
export function stepPostKind(post: string, refKind: string | null | undefined, step: number, lastStep: number): StepPostKind | null {
  const done: StepPostKind = step >= lastStep ? 'finish' : 'step';
  if (post === 'tileComplete') return refKind === 'tileComplete' ? done : null;
  if (post === 'submissions') return refKind === 'submissionComplete' ? done : refKind === 'submission' ? 'progress' : null;
  return null;
}

export interface SharedRoute {
  /** What the shared channels get: the post as is, its step line, or nothing. */
  shared: 'full' | 'step' | 'none';
  /** The team whose own hooks get the WHOLE post when the shared channels don't (null = none). */
  teamOnly: number | null;
}

/** The routing decision for one event post. Rule A wins over rule B. */
export function sharedRoute(args: {
  post: string;
  teamId: number | null | undefined;
  /** standingsHidden(event) at send time. */
  standingsHidden: boolean;
  /** The post names a race tile some OTHER team still sees as a locked "?". */
  tileHiddenFromOthers: boolean;
  /** stepPostKind for the post (null = it has no step line). */
  stepKind: StepPostKind | null;
}): SharedRoute {
  if (!PROGRESS_POST_KINDS.has(args.post)) return { shared: 'full', teamOnly: null };
  const team = args.teamId ?? null;
  if (args.standingsHidden) return { shared: 'none', teamOnly: team };
  if (args.tileHiddenFromOthers) return { shared: args.stepKind && team != null ? 'step' : 'none', teamOnly: team };
  return { shared: 'full', teamOnly: null };
}

/** What a post's veil says, as lib/raceHideAheadDb racePostVeil reads it (null = nothing hidden). */
export interface PostVeil {
  hiddenFromOthers: boolean;
  step: number | null;
  lastStep: number;
  hiddenLabels: string[];
}

/**
 * The whole decision for one event post, as the send path takes it: where it goes and, when the
 * shared channels get a step line, which one. `refKind` is the post's lib/discordPosts ref kind.
 */
export function routeEventPost(args: {
  post: string;
  refKind: string | null | undefined;
  teamId: number | null | undefined;
  standingsHidden: boolean;
  veil: PostVeil | null;
}): SharedRoute & { stepKind: StepPostKind | null } {
  const v = args.veil;
  const stepKind = v?.step != null ? stepPostKind(args.post, args.refKind, v.step, v.lastStep) : null;
  const route = sharedRoute({ post: args.post, teamId: args.teamId, standingsHidden: args.standingsHidden, tileHiddenFromOthers: !!v?.hiddenFromOthers, stepKind });
  return { ...route, stepKind: route.shared === 'step' ? stepKind : null };
}

/** The words of a step line. `step` is 0-based; `steps` is the race's length. */
export function stepPostText(kind: StepPostKind, who: string, step: number, steps: number): { title: string; description: string } {
  const n = step + 1;
  if (kind === 'finish') return { title: `🏁 ${who} finished the race`, description: `All ${steps} steps done.` };
  if (kind === 'step') return { title: `✅ ${who} completed step ${n}`, description: `On to step ${n + 1} of ${steps}.` };
  return { title: `⏳ ${who} made progress on step ${n}`, description: `Step ${n} of ${steps}.` };
}

/** One "made progress" line per team per step per this long; completions always post. */
export const STEP_PROGRESS_WINDOW_MS = 30 * 60_000;

/**
 * May a "made progress" line post now? Records it when yes. `seen` is the caller's own map (one per
 * process); it is pruned as it goes.
 */
export function takeStepProgress(seen: Map<string, number>, key: string, now: number, windowMs = STEP_PROGRESS_WINDOW_MS): boolean {
  const last = seen.get(key);
  if (last != null && now - last < windowMs) return false;
  if (seen.size > 2_000) for (const [k, at] of seen) if (now - at >= windowMs) seen.delete(k);
  seen.set(key, now);
  return true;
}

export const stepProgressKey = (eventId: number, teamId: number, step: number) => `${eventId}:${teamId}:${step}`;

/** What a hidden tile's name becomes when the safety net catches it in a shared post. */
export const SCRUBBED_TILE_NAME = 'a locked tile';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The labels worth scrubbing: trimmed, three characters or more, longest first (so a longer name wins). */
function scrubLabels(labels: Iterable<string>): string[] {
  return [...new Set([...labels].map((l) => l.trim()).filter((l) => l.length >= 3))].sort((a, b) => b.length - a.length);
}

function scrubText(s: string, re: RegExp | null): { text: string; hit: boolean } {
  if (!re) return { text: s, hit: false };
  const text = s.replace(re, SCRUBBED_TILE_NAME);
  return { text, hit: text !== s };
}

interface EmbedLike {
  title?: string;
  description?: string;
  url?: string;
  author?: { name?: string };
  footer?: { text?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: { url: string };
  [k: string]: unknown;
}

/**
 * Replace every hidden tile's name in a shared post with "a locked tile". An embed that named one
 * loses its thumbnail too (a tile's icon is as telling as its name). Same shape out; untouched when
 * nothing matched.
 */
export function scrubHiddenTileNames<P extends { content?: string; embeds?: object[] }>(payload: P, hiddenLabels: Iterable<string>): P {
  const labels = scrubLabels(hiddenLabels);
  if (!labels.length) return payload;
  const re = new RegExp(labels.map(escapeRe).join('|'), 'gi');
  let changed = false;
  const out: P = { ...payload };
  if (typeof payload.content === 'string') {
    const c = scrubText(payload.content, re);
    if (c.hit) {
      out.content = c.text;
      changed = true;
    }
  }
  if (Array.isArray(payload.embeds)) {
    out.embeds = payload.embeds.map((raw) => {
      const e = raw as EmbedLike;
      let hit = false;
      const sc = (s: string | undefined) => {
        if (typeof s !== 'string') return s;
        const r = scrubText(s, re);
        hit ||= r.hit;
        return r.text;
      };
      const next: EmbedLike = { ...e };
      if (e.title != null) next.title = sc(e.title);
      if (e.description != null) next.description = sc(e.description);
      if (e.author) next.author = { ...e.author, ...(e.author.name != null ? { name: sc(e.author.name) } : {}) };
      if (e.footer) next.footer = { ...e.footer, ...(e.footer.text != null ? { text: sc(e.footer.text) } : {}) };
      if (e.fields) next.fields = e.fields.map((f) => ({ ...f, name: sc(f.name) ?? f.name, value: sc(f.value) ?? f.value }));
      if (!hit) return raw;
      changed = true;
      delete next.thumbnail;
      return next;
    });
  }
  return changed ? out : payload;
}

/** Does any hidden tile name appear anywhere in this post? (The tests' check, and a log guard.) */
export function namesHiddenTile(payload: unknown, hiddenLabels: Iterable<string>): boolean {
  const hay = JSON.stringify(payload).toLowerCase();
  return scrubLabels(hiddenLabels).some((l) => hay.includes(l.toLowerCase()));
}

/** A race team's place for a shared standings line (digest, halfway): steps, never a tile. */
export function raceStepPlace(s: { stepsDone: number; finished: boolean }, steps: number): string {
  if (s.finished) return 'finished';
  if (s.stepsDone === 0) return 'at the start';
  return `on step ${Math.min(s.stepsDone + 1, steps)} of ${steps}`;
}
