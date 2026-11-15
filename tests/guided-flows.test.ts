// The guide strips (components/GuidedFlow): each flow's steps, which one is open, and that the
// run-an-event flow says the same thing as the Next step and readiness functions it is built from.
//
// Pure: no database. Run: npm run test:guidedflows

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FLOW_STEP_KEYS, buildFlow, isFlowKey, isFlowStep, selectCurrent, type FlowView } from '../src/lib/guidedFlow.ts';
import { nextStep } from '../src/lib/eventNextStep.ts';
import { computeStartReadiness, startBlockerLabel } from '../src/lib/eventReadiness.ts';
import { setupFacts } from '../src/lib/eventStage.ts';
import { newEventFlow, runEventFlow, type RunEventInput } from '../src/lib/guidedFlows/runEvent.ts';

const states = (v: FlowView) => v.steps.map((s) => `${s.key}:${s.state}`).join(' ');
const keys = (v: FlowView) => v.steps.map((s) => s.key);

/** Every flow's shape rules: one current step, it is the first not-done one, and its keys are registered. */
function assertWellFormed(v: FlowView) {
  for (const s of v.steps) assert.ok(isFlowStep(v.key, s.key), `${v.key}.${s.key} is a registered step`);
  const current = v.steps.filter((s) => s.state === 'current');
  if (v.complete) {
    assert.equal(current.length, 0);
    assert.equal(v.current, null);
    assert.equal(v.stepNumber, 0);
    assert.ok(v.steps.every((s) => s.state === 'done'));
    return;
  }
  assert.equal(current.length, 1, 'exactly one current step');
  assert.equal(v.current?.key, current[0].key);
  assert.equal(v.stepNumber, v.steps.indexOf(current[0]) + 1);
  assert.equal(v.steps.find((s) => s.state !== 'done')?.key, current[0].key, `nothing before the current step is left undone: ${states(v)}`);
  assert.ok(v.current!.sentence.length > 20, 'the open step has a sentence');
  assert.doesNotMatch(v.current!.sentence, /!/, 'no exclamation marks');
  assert.doesNotMatch(v.current!.title, /!/);
}

// ── The core ──────────────────────────────────────────────────────────────────────────────────

test('core: the open step is the first not done, and a preferred step wins only while it is not done', () => {
  const steps = [
    { key: 'a', label: 'A', done: true },
    { key: 'b', label: 'B', done: false },
    { key: 'c', label: 'C', done: false },
  ];
  assert.equal(selectCurrent(steps), 'b');
  assert.equal(selectCurrent(steps, 'c'), 'c');
  assert.equal(selectCurrent(steps, 'a'), 'b', 'a done step is never the open one');
  assert.equal(selectCurrent(steps, 'nope'), 'b');
  assert.equal(selectCurrent(steps.map((s) => ({ ...s, done: true }))), null);
});

test('core: a finished flow has no open step, and only registered flows and steps are accepted', () => {
  const v = buildFlow({
    key: 'moderator',
    name: 'x',
    steps: FLOW_STEP_KEYS.moderator.map((key) => ({ key, label: key, done: true })),
    describe: () => ({ title: '', sentence: '', action: { kind: 'none' } }),
  });
  assert.equal(v.complete, true);
  assert.equal(v.doneCount, v.total);
  assertWellFormed(v);
  assert.equal(isFlowKey('run-event'), true);
  assert.equal(isFlowKey('constructor'), false);
  assert.equal(isFlowKey(7), false);
  assert.equal(isFlowStep('run-event', 'tiles'), true);
  assert.equal(isFlowStep('run-event', 'a typed sentence'), false);
});

// ── Flow a: run an event ──────────────────────────────────────────────────────────────────────

const ready: RunEventInput = {
  eventId: 21,
  usesSignups: true,
  stage: 'build',
  noun: { one: 'tile', many: 'tiles' },
  startDate: '2026-12-01T00:00:00.000Z',
  endDate: '2026-12-14T00:00:00.000Z',
  tileCount: 25,
  expectedTiles: 25,
  teamCount: 4,
  assignedPlayers: 20,
  signupCount: 20,
  pendingSignups: 0,
  flaggedProofs: 0,
  payoutCount: 0,
  unpaidPayouts: 0,
  blockers: [],
  individual: false,
};
const blank: RunEventInput = { ...ready, startDate: null, endDate: null, tileCount: 0, teamCount: 0, assignedPlayers: 0, signupCount: 0 };

test('run an event: before the event exists, choosing the format is the open step', () => {
  const v = newEventFlow();
  assertWellFormed(v);
  assert.equal(v.current?.key, 'format');
  assert.equal(v.stepNumber, 1);
  assert.equal(v.doneCount, 0);
  assert.equal(v.current?.action.kind, 'none', 'the page under the strip is the step');
});

test('run an event: a blank event starts at tiles, with the format already done', () => {
  const v = runEventFlow(blank);
  assertWellFormed(v);
  assert.deepEqual(keys(v), ['format', 'tiles', 'signups', 'teams', 'dates', 'start', 'proofs', 'prizes']);
  assert.equal(v.current?.key, 'tiles');
  assert.equal(v.stepNumber, 2);
  assert.deepEqual(v.current?.action, { kind: 'link', label: 'Add tiles', href: '/admin/events/21/tiles', anchor: 'add-tiles' });
  assert.match(v.current!.sentence, /Click a square/);
  assert.match(v.current!.sentence, /Quick add/);
});

test('run an event: each step done in turn moves the open step along', () => {
  const walk: [Partial<RunEventInput>, string, string][] = [
    [{}, 'tiles', 'Add tiles'],
    [{ tileCount: 25 }, 'signups', 'Copy sign-up link'],
    [{ tileCount: 25, signupCount: 6, pendingSignups: 2 }, 'signups', 'Review sign-ups'],
    [{ tileCount: 25, signupCount: 8 }, 'teams', 'Make teams'],
    [{ tileCount: 25, signupCount: 8, teamCount: 2 }, 'teams', 'Make teams'],
    [{ tileCount: 25, signupCount: 8, teamCount: 2, assignedPlayers: 8 }, 'dates', 'Set the dates'],
    [{ tileCount: 25, signupCount: 8, teamCount: 2, assignedPlayers: 8, startDate: ready.startDate }, 'start', 'Start now'],
    [{ ...ready, stage: 'run' }, 'proofs', 'See the standings'],
    [{ ...ready, stage: 'run', flaggedProofs: 3 }, 'proofs', 'Check proofs'],
    [{ ...ready, stage: 'wrap', flaggedProofs: 1 }, 'proofs', 'Check proofs'],
    [{ ...ready, stage: 'wrap' }, 'prizes', 'Set prizes'],
    [{ ...ready, stage: 'wrap', payoutCount: 3, unpaidPayouts: 2 }, 'prizes', 'Pay prizes'],
  ];
  let lastNumber = 0;
  for (const [patch, step, label] of walk) {
    const v = runEventFlow({ ...blank, ...patch });
    assertWellFormed(v);
    assert.equal(v.current?.key, step, JSON.stringify(patch));
    const a = v.current!.action;
    assert.equal(a.kind === 'none' ? '' : a.label, label);
    assert.ok(v.stepNumber >= lastNumber, 'the open step never moves backwards along the walk');
    lastNumber = v.stepNumber;
  }
});

test('run an event: the dates step lands on the Schedule section, and proofs on the proofs list', () => {
  const dates = runEventFlow({ ...ready, startDate: null }).current!;
  assert.deepEqual(dates.action, { kind: 'link', label: 'Set the dates', href: '/admin/events/21/settings', anchor: 'schedule' });
  assert.match(dates.sentence, /Sign-ups tab/, 'says where the sign-up deadline and fee are');
  const proofs = runEventFlow({ ...ready, stage: 'run', flaggedProofs: 2 }).current!;
  assert.deepEqual(proofs.action, { kind: 'link', label: 'Check proofs', href: '/admin/events/21', anchor: 'proofs' });
  assert.match(proofs.sentence, /Looks fine/, 'uses the words on the buttons');
});

test('run an event: a blocked start says what blocks it and links to what unblocks it', () => {
  const blocker = startBlockerLabel('draft-in-progress');
  const v = runEventFlow({ ...ready, blockers: [blocker] });
  assertWellFormed(v);
  assert.equal(v.current?.key, 'start');
  assert.ok(v.current?.blocked);
  assert.match(v.current!.blocked!.reason, /draft is still in progress/);
  assert.equal(v.current!.blocked!.fix.href, '/admin/events/21/teams');
});

test('run an event: starting is the page’s own action, never a plain link', () => {
  assert.deepEqual(runEventFlow(ready).current?.action, { kind: 'custom', label: 'Start now', id: 'start' });
});

test('run an event: steps this event does not have are left out', () => {
  const solo = runEventFlow({ ...blank, individual: true, usesSignups: false, noun: { one: 'task', many: 'tasks' } });
  assertWellFormed(solo);
  assert.deepEqual(keys(solo), ['format', 'tiles', 'dates', 'start', 'proofs', 'prizes']);
  assert.equal(solo.steps[1].label, 'Tasks');
  const noForm = runEventFlow({ ...blank, usesSignups: false, tileCount: 25 });
  assertWellFormed(noForm);
  assert.deepEqual(keys(noForm), ['format', 'tiles', 'teams', 'dates', 'start', 'proofs', 'prizes']);
  assert.equal(noForm.current?.key, 'teams');
  assert.doesNotMatch(noForm.current!.sentence, /Sign-ups are already open/);
  // Sign-ups arrived anyway (the form was switched off later): the step shows, because there is work in it.
  assert.ok(keys(runEventFlow({ ...blank, usesSignups: false, pendingSignups: 1 })).includes('signups'));
});

test('run an event: complete once the prizes are paid, and then it draws nothing', () => {
  const v = runEventFlow({ ...ready, stage: 'wrap', payoutCount: 3, unpaidPayouts: 0 });
  assertWellFormed(v);
  assert.equal(v.complete, true);
  assert.equal(v.doneCount, v.total);
});

test('run an event agrees with the Next step card, the checklist facts and the readiness gate on sample events', () => {
  let checked = 0;
  for (const stage of ['build', 'run', 'wrap'] as const)
    for (const tileCount of [0, 10, 25])
      for (const [teamCount, assignedPlayers] of [[0, 0], [3, 0], [3, 12]])
        for (const [signupCount, pendingSignups] of [[0, 0], [0, 2], [12, 0], [12, 3]])
          for (const startDate of [null, ready.startDate])
            for (const draftStatus of ['none', 'active'])
              for (const individual of [false, true])
                for (const usesSignups of [true, false])
                  for (const [flaggedProofs, payoutCount, unpaidPayouts] of [[0, 0, 0], [2, 0, 0], [0, 3, 2], [0, 3, 0]]) {
                    // The blockers exactly as lib/eventStageCounts hands them to every surface.
                    const readiness = computeStartReadiness({ draftStatus, teamCount, assignedPlayerCount: assignedPlayers, totalPlayerCount: assignedPlayers });
                    const e: RunEventInput = {
                      ...ready, stage, tileCount, teamCount, assignedPlayers, signupCount, pendingSignups, startDate,
                      individual, usesSignups, flaggedProofs, payoutCount, unpaidPayouts,
                      blockers: readiness.blockers.map(startBlockerLabel),
                    };
                    const v = runEventFlow(e);
                    const next = nextStep(e);
                    const label = `${JSON.stringify({ stage, tileCount, teamCount, assignedPlayers, signupCount, pendingSignups, startDate, draftStatus, individual, usesSignups, flaggedProofs, payoutCount, unpaidPayouts })} → ${states(v)}`;
                    checked++;

                    // The Next step card: same title, same button, and done exactly when it says "all wrapped up".
                    assert.equal(v.complete, next.key === 'wrapped', label);
                    if (v.complete) continue;
                    assert.equal(v.current!.title, next.title, label);
                    const a = v.current!.action;
                    if (next.action.kind === 'start') assert.equal(a.kind, 'custom', label);
                    else if (next.action.kind === 'copy') assert.equal(a.kind, 'copy', label);
                    else if (next.action.kind === 'link') {
                      assert.equal(a.kind, 'link', label);
                      const tab = next.action.tab;
                      const href = a.kind === 'link' ? a.href : '';
                      assert.ok(tab.startsWith('#') ? href === '/admin/events/21' : href === `/admin/events/21/${tab.split('#')[0]}`, label);
                    }

                    // The checklist facts (lib/eventStage setupFacts), before the start.
                    const state = (k: string) => v.steps.find((s) => s.key === k)?.state;
                    if (stage === 'build') {
                      const facts = setupFacts(e, e);
                      assert.equal(state('tiles') === 'done', facts.tilesDone, label);
                      if (!individual) assert.equal(state('teams') === 'done', facts.teamsDone, label);
                      assert.equal(state('dates') === 'done', facts.datesDone, label);
                      assert.notEqual(state('start'), 'done', label);

                      // The readiness gate: the strip offers Start only when the gate would let it through,
                      // and a refusal is shown as a blocked step carrying the gate's own first reason.
                      if (a.kind === 'custom') assert.equal(readiness.ready, true, label);
                      if (v.current!.blocked) {
                        assert.equal(readiness.ready, false, label);
                        assert.ok(v.current!.blocked.reason.includes(startBlockerLabel(readiness.blockers[0])), label);
                      }
                    } else {
                      for (const k of ['format', 'tiles', 'teams', 'signups', 'dates', 'start']) {
                        if (state(k) !== undefined) assert.equal(state(k), 'done', label);
                      }
                    }

                    // One current step, registered keys, and (before the start) nothing undone behind it.
                    for (const s of v.steps) assert.ok(isFlowStep('run-event', s.key), label);
                    assert.equal(v.steps.filter((s) => s.state === 'current').length, 1, label);
                    assert.equal(v.steps.find((s) => s.state !== 'done')?.key, v.current!.key, label);
                  }
  assert.ok(checked > 5000, `walked ${checked} sample events`);
});
