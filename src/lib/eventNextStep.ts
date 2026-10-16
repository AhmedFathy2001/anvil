// The ONE thing an event wants from its admin right now — the forge panel at the top of the event
// home. Every stage of an event has work that moves it forward; this names the next piece of it in
// plain words, with a single action, so an admin never has to work out what comes next.
//
// Pure (no `@/` imports): tests/event-next-step.test.ts runs it directly.

export type EventStage = 'build' | 'run' | 'wrap';

export interface NextStepInput {
  stage: EventStage;
  /** What this board calls its entries, singular and plural ("task"/"tasks", "tile"/"tiles"). */
  noun: { one: string; many: string };
  startDate: string | null;
  endDate: string | null;
  tileCount: number;
  expectedTiles: number;
  teamCount: number;
  assignedPlayers: number;
  signupCount: number;
  pendingSignups: number;
  /** Proofs the system flagged for a human look (submissions.flaggedReason). */
  flaggedProofs: number;
  payoutCount: number;
  unpaidPayouts: number;
  /** Readiness blockers (lib/eventReadiness), already sentences. */
  blockers: string[];
  /** Individual boards (a ladder) have no teams to make. */
  individual: boolean;
}

export type NextStepAction =
  | { kind: 'link'; label: string; tab: string }
  | { kind: 'start'; label: string }
  | { kind: 'none' };

export interface NextStep {
  title: string;
  body: string;
  action: NextStepAction;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

export function nextStep(e: NextStepInput): NextStep {
  if (e.stage === 'build') {
    if (e.expectedTiles > 0 && e.tileCount < e.expectedTiles) {
      const left = e.expectedTiles - e.tileCount;
      return {
        title: e.tileCount === 0 ? `Add your ${e.noun.many}` : `Add ${plural(left, `more ${e.noun.one}`, `more ${e.noun.many}`)}`,
        body:
          e.tileCount === 0
            ? `Write them one by one, paste a list, or pull them from the task library. Plain ${e.noun.many} like “Get a Zenyte shard” are fine.`
            : `${e.tileCount} of ${e.expectedTiles} are written. Finish the board before you open sign-ups.`,
        action: { kind: 'link', label: e.tileCount === 0 ? `Add ${e.noun.many}` : `Finish the ${e.noun.many}`, tab: 'tiles' },
      };
    }
    if (e.pendingSignups > 0) {
      return {
        title: `Approve ${plural(e.pendingSignups, 'sign-up', 'sign-ups')}`,
        body: 'People are waiting to hear if they’re in. Approve them before you make teams.',
        action: { kind: 'link', label: 'Review sign-ups', tab: 'signups' },
      };
    }
    if (!e.individual && e.signupCount === 0 && e.teamCount === 0) {
      return {
        title: 'Open sign-ups',
        body: 'The board is ready. Open sign-ups so people can join, then make teams from who signed up.',
        action: { kind: 'link', label: 'Open sign-ups', tab: 'signups' },
      };
    }
    if (!e.individual && (e.teamCount === 0 || e.assignedPlayers === 0)) {
      return {
        title: 'Make the teams',
        body:
          e.teamCount === 0
            ? `${plural(e.signupCount, 'person has', 'people have')} signed up. Create the teams, then draft or place players.`
            : 'The teams exist but nobody is on one yet. Run the draft or place players by hand.',
        action: { kind: 'link', label: 'Make teams', tab: 'teams' },
      };
    }
    if (!e.startDate) {
      return {
        title: 'Pick the dates',
        body: 'Everything is ready except when it runs. Set a start and end, or start it right now.',
        action: { kind: 'link', label: 'Set the dates', tab: 'settings' },
      };
    }
    if (e.blockers.length > 0) {
      return {
        title: 'Almost ready',
        body: `It can’t start yet: ${e.blockers[0]}.`,
        action: { kind: 'link', label: 'Fix it', tab: 'teams' },
      };
    }
    return {
      title: `Ready. It starts on ${day(e.startDate)}`,
      body: 'Nothing left to do. It opens by itself on schedule, or you can start it now.',
      action: { kind: 'start', label: 'Start now' },
    };
  }

  if (e.stage === 'run') {
    if (e.flaggedProofs > 0) {
      return {
        title: `Check ${plural(e.flaggedProofs, 'proof', 'proofs')}`,
        body: 'Most things count by themselves through the plugin. These were flagged for a human look.',
        action: { kind: 'link', label: 'Check proofs', tab: '#proofs' },
      };
    }
    return {
      title: 'It’s running',
      body: e.endDate
        ? `Nothing needs you right now. It ends on ${day(e.endDate)}.`
        : 'Nothing needs you right now. It runs until you end it.',
      action: { kind: 'link', label: 'See the standings', tab: 'stats' },
    };
  }

  // wrap
  if (e.flaggedProofs > 0) {
    return {
      title: `Check ${plural(e.flaggedProofs, 'proof', 'proofs')} before paying out`,
      body: 'Settle anything flagged first, so the final standings are right.',
      action: { kind: 'link', label: 'Check proofs', tab: '#proofs' },
    };
  }
  if (e.payoutCount === 0) {
    return {
      title: 'Set the prizes',
      body: 'The event is over. Decide who gets what, then mark each prize paid as you hand it out.',
      action: { kind: 'link', label: 'Set prizes', tab: 'payouts' },
    };
  }
  if (e.unpaidPayouts > 0) {
    return {
      title: `Pay ${plural(e.unpaidPayouts, 'prize', 'prizes')}`,
      body: 'Hand out the gp in game, then mark each one paid.',
      action: { kind: 'link', label: 'Pay prizes', tab: 'payouts' },
    };
  }
  return {
    title: 'All wrapped up',
    body: 'Prizes are paid. Nothing left to do here.',
    action: { kind: 'none' },
  };
}
