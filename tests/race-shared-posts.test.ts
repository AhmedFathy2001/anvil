// A tile race's Discord posts under its two privacy settings (lib/raceSharedPosts), the race
// standings' step line (lib/raceSummary), and the plugin's locked step (lib/pluginUi/raceUi).
//
//   A. Hidden standings: no progress of any kind reaches a shared channel; a team's own hook still
//      hears its own team.
//   B. Tiles hidden past the next step (standings visible): shared channels get "made progress on
//      step N" / "completed step N" / "finished the race" and never a hidden tile's name.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DISCORD_POST_TYPES } from '../src/lib/discordPostPolicy.ts';
import { PROGRESS_POST_KINDS } from '../src/lib/standingsVisibility.ts';
import {
  SCRUBBED_TILE_NAME,
  STEP_PROGRESS_WINDOW_MS,
  namesHiddenTile,
  raceStepPlace,
  routeEventPost,
  scrubHiddenTileNames,
  stepPostText,
  stepProgressKey,
  takeStepProgress,
  type PostVeil,
  type StepPostKind,
} from '../src/lib/raceSharedPosts.ts';
import { HIDDEN_RACE_TILE_LABEL, buildRaceVeil, hiddenFromAnotherTeam, maskRaceTile } from '../src/lib/raceHideAhead.ts';
import { raceGraph, teamRoute } from '../src/lib/raceRoutes.ts';
import { raceStandingStep, stepProgress, teamStepProgress } from '../src/lib/raceSummary.ts';
import type { Board, BoardContext } from '../src/lib/pluginUi/boardUi.ts';
import type { Node } from '../src/lib/pluginUi/nodes.ts';
import { lockedStop, racePageUi, type RacePageOpts } from '../src/lib/pluginUi/raceUi.ts';

// ---- The post kinds -------------------------------------------------------------------------------

/** Every post kind, and the lib/discordPosts ref kind its progress posts carry. */
const KINDS = DISCORD_POST_TYPES.map((t) => t.key);
const REF: Record<string, string | undefined> = { tileComplete: 'tileComplete', submissions: 'submission', teamWin: 'teamWin' };
/** Posts that name the tile they're about (the rest name none). */
const NAMES_TILE = new Set(['submissions', 'submissionRemoved', 'tileComplete']);
/** Kinds that are never progress: start/finish framing, the draft, reveals, sign-ups, staff info. */
const NOT_PROGRESS = new Set(['boardRevealed', 'eventStart', 'rules', 'startHeld', 'standingsRevealed', 'draftStart', 'draftDone', 'reveals', 'signupApproved', 'payouts']);

test('every post kind is either progress (gated) or explicitly not progress', () => {
  for (const k of KINDS) assert.ok(PROGRESS_POST_KINDS.has(k) !== NOT_PROGRESS.has(k), `${k}: decide whether it is progress`);
  // The race's own beats and recaps are all progress.
  for (const k of ['submissions', 'tileComplete', 'teamWin', 'digest', 'halfway', 'claims', 'eventEnd']) assert.ok(PROGRESS_POST_KINDS.has(k), k);
});

// A three-step straight race: 1 → 2 → 3 (finish). Team 4 has done 1 and stands on 2; team 5 hasn't started.
const LINE = [
  { id: 1, position: 0, raceStep: 0, raceNext: [2] },
  { id: 2, position: 1, raceStep: 1, raceNext: [3] },
  { id: 3, position: 2, raceStep: 2, raceNext: [] },
];
const LABEL: Record<number, string> = { 1: 'Wintertodt crate', 2: 'Vorkath head', 3: 'Chambers of Xeric' };
const g = raceGraph(LINE);
const veilOf = (team4: number[]) =>
  buildRaceVeil('players', g, new Map([[4, teamRoute(g, team4)], [5, teamRoute(g, [])]]));

/** The veil a post about team 4's tile `tileId` sees, as racePostVeil would build it. */
function postVeil(tileId: number | null, team4: number[] = [1]): PostVeil {
  const v = veilOf(team4);
  const hiddenLabels = Object.entries(LABEL).filter(([id]) => !v.everyone.has(Number(id))).map(([, l]) => l);
  return { hiddenFromOthers: tileId != null && hiddenFromAnotherTeam(v, tileId, 4), step: tileId != null ? v.stepOf.get(tileId) ?? null : null, lastStep: v.lastStep, hiddenLabels };
}

type Setting = 'live' | 'A' | 'B' | 'A+B';
const SETTINGS: Setting[] = ['live', 'A', 'B', 'A+B'];

/**
 * What each destination receives for one post, composed exactly as lib/discord sendEventBingoWebhook
 * does it: the team's own hook, then the shared channels (step line or scrubbed post).
 */
function deliver(kind: string, setting: Setting, tileId: number | null, refKind = REF[kind], progressOk = true) {
  const tiles = setting === 'B' || setting === 'A+B';
  const veil = tiles ? postVeil(tileId) : null;
  const teamId = kind === 'digest' || kind === 'halfway' || NOT_PROGRESS.has(kind) ? null : 4;
  const route = routeEventPost({ post: kind, refKind, teamId, standingsHidden: setting === 'A' || setting === 'A+B', veil });
  const name = tileId != null ? LABEL[tileId] : null;
  const payload = { embeds: [{ title: name ? `✅ Tile complete — ${name}` : 'Post', description: name ? `**Team Four** cleared ${name}.` : 'Something happened.', thumbnail: { url: 'https://x/icon.png' } }] };
  const own = route.shared !== 'full' && route.teamOnly != null ? payload : null;
  let shared: object | null = null;
  if (route.shared === 'full') shared = payload;
  else if (route.shared === 'step' && (route.stepKind !== 'progress' || progressOk)) {
    const w = stepPostText(route.stepKind!, 'Team Four', veil!.step!, veil!.lastStep + 1);
    shared = { embeds: [{ title: w.title, description: w.description }] };
  }
  if (shared && veil?.hiddenLabels.length) shared = scrubHiddenTileNames(shared as { embeds: object[] }, veil.hiddenLabels);
  return { route, own, shared, veil };
}

test('the post kind × visibility matrix: where each post goes', () => {
  // Team 4 is on step 2 (tile 2, hidden from team 5). A post naming tile 2:
  for (const kind of KINDS) {
    const tile = NAMES_TILE.has(kind) ? 2 : null;
    for (const setting of SETTINGS) {
      const { route } = deliver(kind, setting, tile);
      const at = `${kind} / ${setting}`;
      if (!PROGRESS_POST_KINDS.has(kind)) {
        assert.equal(route.shared, 'full', at);
        continue;
      }
      if (setting === 'live') assert.equal(route.shared, 'full', at);
      else if (setting === 'A' || setting === 'A+B') {
        // Rule A: nothing shared; a team's own post still goes to its own hook.
        assert.equal(route.shared, 'none', at);
        assert.equal(route.teamOnly, kind === 'digest' || kind === 'halfway' ? null : 4, at);
      } else if (kind === 'tileComplete' || kind === 'submissions') {
        // Rule B: the step line in shared channels, the whole post in the team's own hook.
        assert.equal(route.shared, 'step', at);
        assert.equal(route.teamOnly, 4, at);
      } else if (tile != null) {
        // Names a hidden tile and has no step line (a removed submission): the team's hook only.
        assert.equal(route.shared, 'none', at);
        assert.equal(route.teamOnly, 4, at);
      } else {
        // Names no tile (team wins, digests, claims, the end): shared, with names scrubbed.
        assert.equal(route.shared, 'full', at);
      }
    }
  }
});

test('no shared post under rule B (or A) ever names or pictures a hidden tile', () => {
  for (const kind of KINDS) {
    for (const setting of ['B', 'A+B'] as const) {
      for (const tile of [1, 2, 3, null]) {
        const { shared, own, veil } = deliver(kind, setting, tile);
        if (shared) {
          assert.ok(!namesHiddenTile(shared, veil!.hiddenLabels), `${kind}/${setting}/${tile}: ${JSON.stringify(shared)}`);
          if (tile != null && veil!.hiddenLabels.includes(LABEL[tile])) assert.ok(!JSON.stringify(shared).includes('icon.png'), `${kind}/${setting}/${tile}: icon`);
        }
        // The team's own hook keeps the name: it's that team's tile.
        if (own && tile != null) assert.ok(JSON.stringify(own).includes(LABEL[tile]));
      }
    }
  }
});

test('rule B step lines: progress, step done, the finish', () => {
  const words = (kind: string, ref: string, tile: number, mine: number[]) => {
    const veil = postVeil(tile, mine);
    const r = routeEventPost({ post: kind, refKind: ref, teamId: 4, standingsHidden: false, veil });
    return r.stepKind ? stepPostText(r.stepKind, 'Team Four', veil.step!, veil.lastStep + 1).title : null;
  };
  assert.equal(words('submissions', 'submission', 2, [1]), '⏳ Team Four made progress on step 2');
  assert.equal(words('submissions', 'submissionComplete', 2, [1, 2]), '✅ Team Four completed step 2');
  assert.equal(words('tileComplete', 'tileComplete', 2, [1, 2]), '✅ Team Four completed step 2');
  assert.equal(words('tileComplete', 'tileComplete', 3, [1, 2, 3]), '🏁 Team Four finished the race');
  // A correction or a combo part carries no ref: no step line, so it stays in the team's hook.
  assert.equal(routeEventPost({ post: 'tileComplete', refKind: undefined, teamId: 4, standingsHidden: false, veil: postVeil(2) }).shared, 'none');
  // A tile everyone can see (the start, before anyone has moved on) posts as it always did.
  const start = buildRaceVeil('players', g, new Map([[4, teamRoute(g, [])], [5, teamRoute(g, [])]]));
  assert.equal(hiddenFromAnotherTeam(start, 1, 4), false);
});

test('"made progress" is coalesced: one per team per step per window; completions always post', () => {
  const seen = new Map<string, number>();
  const k = stepProgressKey(9, 4, 1);
  assert.equal(takeStepProgress(seen, k, 0), true);
  assert.equal(takeStepProgress(seen, k, 60_000), false);
  assert.equal(takeStepProgress(seen, stepProgressKey(9, 5, 1), 60_000), true, 'another team');
  assert.equal(takeStepProgress(seen, stepProgressKey(9, 4, 2), 60_000), true, 'the next step');
  assert.equal(takeStepProgress(seen, k, STEP_PROGRESS_WINDOW_MS), true, 'after the window');
  // A held progress line never holds back a completion: those have no window.
  const held = deliver('submissions', 'B', 2, 'submission', false);
  assert.equal(held.shared, null);
  assert.ok(held.own, 'the team still hears its own drop');
  assert.ok(deliver('submissions', 'B', 2, 'submissionComplete', false).shared);
});

test('the safety net: a digest award naming a hidden tile is scrubbed, icon and all', () => {
  const digest = {
    embeds: [{
      title: '📅 Day 2 recap',
      description: 'Here’s how day 2 went.',
      thumbnail: { url: 'https://x/vorkath.png' },
      fields: [{ name: '🏅 Today’s awards', value: '💎 **Big Baller** — Zezima _(5m gp · vorkath head)_', inline: false }],
    }],
  };
  const out = scrubHiddenTileNames(digest, ['Vorkath head', 'Chambers of Xeric']);
  assert.ok(!namesHiddenTile(out, ['Vorkath head']));
  assert.ok(JSON.stringify(out).includes(SCRUBBED_TILE_NAME));
  assert.equal((out.embeds[0] as { thumbnail?: unknown }).thumbnail, undefined);
  // Nothing to scrub: the same object back.
  assert.equal(scrubHiddenTileNames(digest, ['Zulrah unique']), digest);
  // Short names are left alone (a two-letter label would chew through ordinary words).
  assert.equal(scrubHiddenTileNames(digest, ['Da']), digest);
});

test('digest and halfway standings for a race read per step', () => {
  assert.equal(raceStepPlace({ stepsDone: 0, finished: false }, 5), 'at the start');
  assert.equal(raceStepPlace({ stepsDone: 2, finished: false }, 5), 'on step 3 of 5');
  assert.equal(raceStepPlace({ stepsDone: 5, finished: true }, 5), 'finished');
});

test('the veil knows each tile\'s step', () => {
  const v = veilOf([1]);
  assert.deepEqual([...v.stepOf], [[1, 0], [2, 1], [3, 2]]);
  assert.equal(v.lastStep, 2);
});

// ---- The site's race standings -------------------------------------------------------------------

test('race standings say the step and the count on it, never the tile', () => {
  assert.equal(raceStandingStep({ stepsDone: 0, finished: false }, 5), 'Step 1 of 5');
  assert.equal(raceStandingStep({ stepsDone: 1, finished: false }, 5, { current: 2, goal: 5 }), 'Step 2 of 5 · 2/5');
  assert.equal(raceStandingStep({ stepsDone: 1, finished: false }, 5, { current: 9, goal: 5 }), 'Step 2 of 5 · 5/5');
  assert.equal(raceStandingStep({ stepsDone: 5, finished: true }, 5, { current: 2, goal: 5 }), 'Finished');
  // A one-off tile has no count worth showing.
  assert.equal(raceStandingStep({ stepsDone: 1, finished: false }, 5, { current: 0, goal: 1 }), 'Step 2 of 5');
});

test('step progress: the open tile at the team\'s next step it is furthest along on', () => {
  const fork = raceGraph([
    { id: 10, position: 0, raceStep: 0, raceNext: [20, 21] },
    { id: 20, position: 1, raceStep: 1, raceNext: [30] },
    { id: 21, position: 2, raceStep: 1, raceNext: [30] },
    { id: 30, position: 3, raceStep: 2, raceNext: [] },
  ]);
  const counts: Record<string, { current: number; goal: number }> = { '4:20': { current: 1, goal: 5 }, '4:21': { current: 3, goal: 4 }, '4:30': { current: 9, goal: 10 } };
  const of = (team: number, tile: number) => counts[`${team}:${tile}`] ?? null;
  assert.deepEqual(stepProgress(fork, teamRoute(fork, [10]), (t) => of(4, t)), { current: 3, goal: 4 });
  // A tile further ahead doesn't count yet.
  assert.equal(stepProgress(fork, teamRoute(fork, []), (t) => of(4, t)), null);
  const all = teamStepProgress(fork, [{ id: 4, name: 'Four', color: '#fff' }, { id: 5, name: 'Five', color: '#fff' }], [{ teamId: 4, tileId: 10 }], of);
  assert.deepEqual(all, { 4: { current: 3, goal: 4 }, 5: null });
});

// ---- The plugin's locked step --------------------------------------------------------------------

function walk(n: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!n || typeof n !== 'object') return out;
  if (Array.isArray(n)) n.forEach((x) => walk(x, out));
  else {
    out.push(n as Record<string, unknown>);
    Object.values(n).forEach((v) => walk(v, out));
  }
  return out;
}
const texts = (n: unknown) => walk(n).filter((x) => x.t === 'text').map((x) => x.s as string);

/** Four steps: 1 → (2 | 3) → (4 | 5 | 6 | 7 | 8, reached from both) → 9. The viewer has done 1 and 2. */
function hiddenBoard(mask: boolean): Board {
  const T: [number, number, string, number[]][] = [
    [1, 0, 'Wintertodt crate', [2, 3]],
    [2, 1, 'Vorkath head', [4, 5, 6, 7, 8]],
    [3, 1, 'Zulrah unique', [4, 5, 6, 7, 8]],
    [4, 2, 'Tanzanite fang', [9]],
    [5, 2, 'Barrows set', [9]],
    [6, 2, 'Dragon warhammer', [9]],
    [7, 2, 'Abyssal whip', [9]],
    [8, 2, 'Kraken tentacle', [9]],
    [9, 3, 'Chambers of Xeric', []],
  ];
  const graph = raceGraph(T.map(([id, step, , next]) => ({ id, position: id, raceStep: step, raceNext: next })));
  const mine = [1, 2];
  const route = teamRoute(graph, mine);
  // What the plugin board sends a team under "Hide tiles past the next step": its road and what it can
  // play now; everything else a masked "?" (lib/raceHideAhead maskRaceTile).
  const seen = new Set([...route.path, ...route.open]);
  const tiles = T.map(([id, step, label, next]) => {
    const t = { tileId: id, id, label, icon: `https://x/${id}.png`, position: id, raceStep: step, raceNext: next, raceState: route.state.get(id) ?? null, tileType: 'drop', complete: mine.includes(id), points: 1, autoTrackDisabled: true };
    if (!mask || seen.has(id)) return t;
    const m = maskRaceTile(t);
    return { ...m, tileId: id, raceState: t.raceState };
  });
  return {
    yourTeamId: 4,
    readOnly: false,
    race: { steps: 4, mode: 'achieve', path: route.path, open: route.open, pickFrom: route.pickFrom, finished: false, rank: 1, entrants: 2, leaderSteps: 2, field: [], standings: [{ teamId: 4, rank: 1, stepsDone: 2, finished: false }, { teamId: 5, rank: 2, stepsDone: 0, finished: false }] },
    teams: [{ teamId: 4, name: 'Four', color: '#ffffff', completedTileIds: mine }, { teamId: 5, name: 'Five', color: '#ff0000', completedTileIds: [] }],
    tiles,
  } as unknown as Board;
}
const ctx: BoardContext = { eventId: 77, claimBlock: null, pins: [], boardPath: '/events/77', progress: new Map() } as unknown as BoardContext;
const opts: RacePageOpts = {
  title: 'Race', back: { a: 'load', v: 'home', args: {} }, rest: [], ctx,
  teams: { a: 'load', v: 'teams', args: {} }, reload: { a: 'load', v: 'home', args: {} }, pick: { event: '0', home: 'board' },
};

test('the locked step node: "Step 4 · Locked · 5 tiles", no name, no icon, nothing to open', () => {
  const n = lockedStop('Step 4', 5) as { t: string; dot: string; on?: unknown };
  assert.equal(n.t, 'step');
  assert.equal(n.dot, 'lock');
  assert.equal(n.on, undefined);
  assert.deepEqual(texts(n), ['Step 4', 'Locked · 5 tiles']);
  assert.deepEqual(texts(lockedStop('Finish', 1, true)), ['Finish', 'Locked · 1 tile']);
  assert.equal((lockedStop('Finish', 1, true) as { dot: string }).dot, 'end');
});

test('a hidden race on the panel: steps not unlocked show as locked with their tile count', () => {
  const main = (racePageUi(hiddenBoard(true), opts) as { panes: Record<string, Node> }).panes.main;
  const s = texts(main);
  // Step 3 (the viewer stands on it: its tile is open) keeps its name; step 4, the finish, is locked.
  const steps = walk(main).filter((x) => x.t === 'step');
  const lockedRows = steps.filter((x) => texts(x).some((t) => t.startsWith('Locked · ')));
  assert.deepEqual(lockedRows.map((x) => texts(x)), [['Finish', 'Locked · 1 tile']]);
  assert.ok(lockedRows.every((x) => x.on === undefined));
  // No hidden tile's name anywhere on the page, and no "Locked tile" placeholder rows on the track.
  for (const name of ['Zulrah unique', 'Chambers of Xeric']) assert.ok(!s.some((t) => t.includes(name)), name);
  assert.ok(!texts(steps).some((t) => t.includes(HIDDEN_RACE_TILE_LABEL)));
  // The viewer's own road still reads as before.
  assert.ok(s.includes('Wintertodt crate'));
  assert.ok(s.includes('Vorkath head'));
});

test('a viewer two steps from a hidden step sees each locked step with its count', () => {
  // Fresh team: done nothing. Step 1 is open (named); steps 2, 3 and the finish are locked.
  const b = hiddenBoard(true) as unknown as { race: Record<string, unknown>; tiles: Record<string, unknown>[] };
  const graph = raceGraph([1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ id, position: id, raceStep: id === 1 ? 0 : id <= 3 ? 1 : id <= 8 ? 2 : 3, raceNext: id === 1 ? [2, 3] : id <= 3 ? [4, 5, 6, 7, 8] : id <= 8 ? [9] : [] })));
  const route = teamRoute(graph, []);
  b.race = { ...b.race, path: [], open: route.open, finished: false };
  b.tiles = b.tiles.map((t) => (t.tileId === 1 ? { ...t, label: 'Wintertodt crate', raceHidden: undefined, raceState: 'open', complete: false } : { ...maskRaceTile({ id: t.tileId as number, label: 'x', ...t }), tileId: t.tileId, raceState: 'ahead' }));
  const main = (racePageUi(b as unknown as Board, opts) as { panes: Record<string, Node> }).panes.main;
  const locked = walk(main).filter((x) => x.t === 'step').map((x) => texts(x)).filter((t) => t[1]?.startsWith('Locked'));
  assert.deepEqual(locked, [['Step 2', 'Locked · 2 tiles'], ['Step 3', 'Locked · 5 tiles'], ['Finish', 'Locked · 1 tile']]);
});

test('unlocked steps keep the existing look (no lock rows on an open board)', () => {
  const main = (racePageUi(hiddenBoard(false), opts) as { panes: Record<string, Node> }).panes.main;
  assert.ok(!texts(main).some((t) => t.startsWith('Locked · ')));
});

// Keep the type import honest: every step kind has words.
test('every step kind has words', () => {
  for (const k of ['progress', 'step', 'finish'] as StepPostKind[]) assert.ok(stepPostText(k, 'T', 0, 3).title.includes('T'));
});
