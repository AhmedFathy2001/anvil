// Flow a: run an event, from choosing its format to paying its prizes.
//
// THE OPEN STEP IS NOT DECIDED HERE. lib/eventNextStep already answers "what does this event want
// from its admin now" and lib/eventStage answers "is this part done"; this places those two answers
// on one list of steps, so the strip, the event home's checklist and the readiness gate can never
// disagree. The step's button is the Next step's own action. Only the sentence is written here, and
// each one answers the question the guide review found people stuck on at that point.
//
// Pure (no `@/` imports): tests/guided-flows.test.ts runs it directly.

import { TEAM_UP_HOW, nextStep, type NextStep, type NextStepInput } from '../eventNextStep.ts';
import { setupFacts } from '../eventStage.ts';
import { buildFlow, plural, type FlowAction, type FlowStepCopy, type FlowStepDef, type FlowView } from '../guidedFlow.ts';

export const RUN_EVENT_NAME = 'Run an event';

export interface RunEventInput extends NextStepInput {
  eventId: number;
  /** The event takes sign-ups (events.signupsEnabled). Off, people are enrolled without a form. */
  usesSignups: boolean;
}

/** Which step of the flow each Next step answer belongs to. */
function stepOf(next: NextStep['key'], hasSignupStep: boolean, hasTeamStep: boolean): string | null {
  switch (next) {
    case 'tiles':
      return 'tiles';
    case 'approve':
    case 'share':
      return hasSignupStep ? 'signups' : hasTeamStep ? 'teams' : 'start';
    case 'teams':
      return 'teams';
    case 'dates':
      return 'dates';
    case 'blocked':
    case 'ready':
      return 'start';
    case 'proofs':
    case 'running':
      return 'proofs';
    case 'prizes-set':
    case 'prizes-pay':
      return 'prizes';
    case 'wrapped':
      return null;
  }
}

/** The Next step's action, as somewhere the strip can go. */
function actionOf(next: NextStep, eventId: number): FlowAction {
  const base = `/admin/events/${eventId}`;
  const a = next.action;
  if (a.kind === 'none') return { kind: 'none' };
  if (a.kind === 'copy') return { kind: 'copy', label: a.label, path: `/events/${eventId}/${a.path}` };
  if (a.kind === 'start') return { kind: 'custom', label: a.label, id: 'start' };
  if (a.kind === 'team-up') return { kind: 'custom', label: a.label, id: 'team-up' };
  if (a.tab.startsWith('#')) return { kind: 'link', label: a.label, href: base, anchor: a.tab.slice(1) };
  const [path, anchor] = a.tab.split('#');
  // The tiles page marks its Add tiles control, so the button lands on it.
  const tilesAnchor = path === 'tiles' ? 'add-tiles' : undefined;
  return { kind: 'link', label: a.label, href: `${base}/${path}`, anchor: anchor ?? tilesAnchor };
}

/**
 * `page: 'teams'` is the strip as drawn ON the Teams page. While the event is still being built and
 * its teams are not done, that page's strip opens the Teams step, whatever comes first in order:
 * somebody who went there to make teams is not told to go and write tiles by the page they are on.
 * The step list is unchanged, so an unfinished earlier step still shows as to do.
 */
export function runEventFlow(e: RunEventInput, opts: { page?: 'teams' } = {}): FlowView {
  const base = `/admin/events/${e.eventId}`;
  const sequential = nextStep(e);
  const onTeams =
    opts.page === 'teams' && e.stage === 'build' && !e.individual && !setupFacts(e, e).teamsDone && sequential.key !== 'teams';
  // A board whose teams are made from sign-ups has nothing to build on that page: with nobody signed
  // up the job is to share the link, and with people waiting it is to team them up. Both are buttons.
  const fromSignups = e.placement === 'auto' || e.placement === 'solo';
  const next: NextStep = !onTeams
    ? sequential
    : fromSignups && e.signupCount === 0
    ? { key: 'share', title: 'Share the sign-up link', body: '', action: { kind: 'copy', label: 'Copy sign-up link', path: 'signup' } }
    : fromSignups && e.pendingSignups === 0
    ? { key: 'teams', title: 'Team everyone up', body: '', action: { kind: 'team-up', label: 'Team everyone up' } }
    : { key: 'teams', title: e.teamCount === 0 ? 'Make the teams' : 'Put players on the teams', body: '', action: { kind: 'none' } };
  // Only the hand-built Teams step is described by the page itself (no button: the page is the step).
  const pageIsStep = onTeams && next.action.kind === 'none';
  const built = e.stage !== 'build';
  const facts = setupFacts(e, e);
  // A step only appears when this event has that job: an individual board makes no teams, and one
  // that enrols people without a form has no sign-ups to open (unless some arrived anyway).
  const hasTeamStep = !e.individual;
  const hasSignupStep = e.usesSignups || e.pendingSignups > 0 || e.signupCount > 0;
  const wrapped = next.key === 'wrapped';

  const steps: FlowStepDef[] = [
    { key: 'format', label: 'Format', done: true },
    { key: 'tiles', label: capital(e.noun.many), done: built || facts.tilesDone || e.expectedTiles === 0 },
    ...(hasSignupStep
      ? [
          {
            key: 'signups',
            label: 'Sign-ups',
            // Nobody waiting on an answer, and somebody is in (or teams were made by hand).
            done: built || (e.pendingSignups === 0 && (e.individual || e.signupCount > 0 || e.teamCount > 0)),
          },
        ]
      : []),
    ...(hasTeamStep ? [{ key: 'teams', label: 'Teams', done: built || facts.teamsDone }] : []),
    { key: 'dates', label: 'Dates', done: built || facts.datesDone },
    { key: 'start', label: 'Start', done: built },
    { key: 'proofs', label: 'Proofs', done: e.stage === 'wrap' && e.flaggedProofs === 0 },
    { key: 'prizes', label: 'Prizes', done: wrapped },
  ];

  return buildFlow({
    key: 'run-event',
    name: RUN_EVENT_NAME,
    steps,
    preferred: stepOf(next.key, hasSignupStep, hasTeamStep),
    describe: () => ({ title: next.title, ...(pageIsStep ? teamsPageCopy(e) : copyFor(e, next, base)) }),
  });
}

/** The Teams step as the Teams page shows it: no button, because the page under the strip is the step. */
function teamsPageCopy(e: RunEventInput): Omit<FlowStepCopy, 'title'> {
  return {
    sentence:
      e.placement === 'auto' || e.placement === 'solo'
        ? // Reached only while sign-ups still wait for an answer: nobody can be seated before that.
          'Teams are made from sign-ups here, so there is nothing to build: approve the people waiting on the Sign-ups tab and each one joins a team.'
        : e.teamCount === 0
        ? 'Create the teams below, then draft or place players on them; the event cannot start until somebody is on a team.'
        : 'The teams exist but nobody is on one, and the event cannot start like that: run the draft or place players by hand below.',
    action: { kind: 'none' },
    guideHref: '/guide/admin#teams',
  };
}

function copyFor(e: RunEventInput, next: NextStep, base: string): Omit<FlowStepCopy, 'title'> {
  const action = actionOf(next, e.eventId);
  switch (next.key) {
    case 'tiles':
      if (e.race) {
        return {
          sentence:
            e.tileCount === 0
              ? `Pick the shape of the roads on the Map tab, then click each ${e.noun.one} and type its task, so players have something to race through.`
              : `${e.tileCount} of ${e.expectedTiles} are written, and players see the blank ones as empty squares until you fill them.`,
          action,
          guideHref: '/guide/board#race',
        };
      }
      return {
        sentence:
          e.tileCount === 0
            ? `Click a square and type the task, like "100 zulrah", and it is set up to count by itself; for a long list use Add ${e.noun.many}, then Quick add.`
            : `${e.tileCount} of ${e.expectedTiles} are written, and players see the blank ones as empty squares until you fill them.`,
        action,
        guideHref: e.tileCount === 0 ? '/guide/board#pick' : '/guide/board#bulk',
      };
    case 'approve':
      return {
        sentence: `${plural(e.pendingSignups, 'person is', 'people are')} waiting to hear if they are in, and they cannot be put on a team until you approve them.`,
        action,
        guideHref: '/guide/admin#teams',
      };
    case 'share':
      return {
        sentence: e.placement === 'auto' || e.placement === 'solo'
          ? 'Teams are made from sign-ups, so there is nothing to build yet: copy the link and post it in your Discord. Once someone signs up they are placed on a team and the event can start.'
          : e.usesSignups
          ? 'Sign-ups are already open, so there is nothing to switch on: copy the link and post it in your Discord so people can join.'
          : 'Nobody is in yet: copy the link and post it in your Discord so members can join, then make teams from who turns up.',
        action,
        guideHref: '/guide/admin#teams',
      };
    case 'teams':
      if (next.action.kind === 'team-up') {
        return {
          sentence: `${plural(e.signupCount, 'person has', 'people have')} signed up but nobody is on a team yet, and the event cannot start like that. ${TEAM_UP_HOW[e.placement === 'solo' ? 'solo' : 'auto']}`,
          action,
          guideHref: '/guide/admin#teams',
        };
      }
      return {
        sentence:
          e.teamCount === 0
            ? `${plural(e.signupCount, 'person has', 'people have')} signed up, and the event cannot start until they are on teams: create the teams, then draft or place players.`
            : 'The teams exist but nobody is on one, and the event cannot start like that: run the draft or place players by hand.',
        action,
        guideHref: '/guide/admin#teams',
      };
    case 'dates':
      return {
        sentence:
          'Set when it starts and ends under Settings, Schedule, so it opens by itself; the sign-up deadline and fee are on the Sign-ups tab.',
        action,
        guideHref: '/guide/admin#launch',
      };
    case 'blocked':
      return {
        sentence: 'Everything else is ready, but it will not start by itself until this is sorted.',
        action,
        guideHref: '/guide/admin#launch',
        blocked: {
          reason: `It cannot start yet: ${e.blockers[0]}.`,
          fix: { label: 'Open teams', href: `${base}/teams` },
        },
      };
    case 'ready':
      return {
        sentence:
          'Nothing is left to do: it opens by itself on that day, or you can start it now, which announces it in Discord and shows the board to members.',
        action,
        guideHref: '/guide/admin#launch',
      };
    case 'proofs':
      return {
        sentence:
          e.stage === 'wrap'
            ? 'Settle these before paying out so the final standings are right: Looks fine keeps a proof, Remove takes the credit back.'
            : 'These already count, but were flagged for a person to look at: Looks fine keeps a proof, Remove takes the credit back and tells the team why.',
        action,
        guideHref: '/guide/moderator#submissions',
      };
    case 'running':
      return {
        sentence: e.endDate
          ? 'Nothing needs you right now: most things count by themselves through the plugin, and any proof that needs a look shows up here.'
          : 'Nothing needs you right now, and with no end date it runs until you press End event now on this event’s home page.',
        action,
        guideHref: '/guide/admin#launch',
      };
    case 'prizes-set':
      return {
        sentence: 'The event is over: decide who gets what on the Prizes page, so winners can see what they are owed.',
        action,
        guideHref: '/guide/admin#after',
      };
    case 'prizes-pay':
      return {
        sentence: 'Hand out the gp in game, then mark each prize paid here so nobody is asked twice.',
        action,
        guideHref: '/guide/admin#after',
      };
    case 'wrapped':
      return { sentence: '', action: { kind: 'none' } };
  }
}

/**
 * Before the event exists: the strip on the create pages, with the first step open. There is no
 * button, because the page under the strip IS the step.
 */
export function newEventFlow(opts: { quick?: boolean; picked?: string } = {}): FlowView {
  const steps: FlowStepDef[] = [
    { key: 'format', label: 'Format', done: false },
    { key: 'tiles', label: 'Tiles', done: false },
    { key: 'signups', label: 'Sign-ups', done: false },
    { key: 'teams', label: 'Teams', done: false },
    { key: 'dates', label: 'Dates', done: false },
    { key: 'start', label: 'Start', done: false },
    { key: 'proofs', label: 'Proofs', done: false },
    { key: 'prizes', label: 'Prizes', done: false },
  ];
  return buildFlow({
    key: 'run-event',
    name: RUN_EVENT_NAME,
    steps,
    describe: () => ({
      // `picked`: the second create screen, with the format already chosen.
      title: opts.picked ? 'Name it and create it' : 'Choose a format',
      sentence: opts.picked
        ? `You picked ${opts.picked}; give it a name and create it, and tiles, teams and dates each get their own step afterwards.`
        : opts.quick
        ? 'Pick one of the three below and give it a name; tiles, teams and dates each get their own step afterwards.'
        : 'Pick the kind of event below; only the format is fixed here, and tiles, teams and dates each get their own step afterwards.',
      action: { kind: 'none' },
      guideHref: '/guide/formats#choose',
    }),
  });
}

function capital(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
