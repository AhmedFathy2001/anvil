// Flow e: a moderator's round. Open the proof queue, settle what is in it, then the people waiting
// for a yes or no.
//
// Both counts are the ones the admin sidebar already badges (lib/flaggedProofs, the Needs review
// tab). With nothing waiting in either, the flow is complete and draws nothing.
//
// Pure (no `@/` imports): tests/guided-flows.test.ts runs it directly.

import { buildFlow, plural, type FlowStepCopy, type FlowStepDef, type FlowView } from '../guidedFlow.ts';

export const MODERATOR_NAME = 'Checking proofs';

export interface ModeratorFacts {
  /** Proofs flagged for a person to look at, across the clan's boards. */
  flaggedProofs: number;
  /** Members and claim requests waiting under Players, Needs review. */
  peopleWaiting: number;
  /** They are on the proof queue page now. */
  onQueue: boolean;
}

export function moderatorFlow(f: ModeratorFacts): FlowView {
  const clear = f.flaggedProofs === 0;
  const steps: FlowStepDef[] = [
    { key: 'queue', label: 'Open the queue', done: clear || f.onQueue },
    { key: 'decide', label: 'Keep or remove', done: clear },
    // Only a step when somebody IS waiting. With nobody, it used to sit at the end already ticked,
    // a done step after the open one, as if the round had been walked out of order.
    ...(f.peopleWaiting > 0 ? [{ key: 'next', label: 'People waiting', done: false }] : []),
  ];

  const describe = (key: string): FlowStepCopy => {
    switch (key) {
      case 'queue':
        return {
          title: `${plural(f.flaggedProofs, 'proof needs', 'proofs need')} a look`,
          sentence:
            'These already count for their teams; they were flagged for a person to check, and the queue lists them board by board, oldest first.',
          action: { kind: 'link', label: 'Open the proof queue', href: '/admin/proofs' },
          guideHref: '/guide/moderator#queue',
        };
      case 'decide':
        return {
          title: 'Keep it or remove it',
          sentence:
            'Open the screenshot, then press Looks fine to keep the proof or Remove to take the credit back; the team sees the reason you give, and a call you are unsure of goes to an admin.',
          action: { kind: 'none' },
          guideHref: '/guide/moderator#submissions',
        };
      default:
        return {
          title: `${plural(f.peopleWaiting, 'person is', 'people are')} waiting for a yes or no`,
          sentence:
            'Under Players, Needs review, check that the Discord name belongs to the character, then confirm; a request you do not recognise can be left for an admin.',
          action: { kind: 'link', label: 'Open Needs review', href: '/admin/people/needs-review' },
          guideHref: '/guide/moderator#verify',
        };
    }
  };

  return buildFlow({ key: 'moderator', name: MODERATOR_NAME, steps, describe });
}
