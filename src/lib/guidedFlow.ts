// Guided flows: step-by-step guidance shown on the pages themselves (components/GuidedFlow).
//
// A flow is a short ordered list of steps with exactly one marked current. Everything here is PURE
// data and pure functions (no `@/` imports), so tests/guided-flows.test.ts runs it without a
// database. A step is done because of a fact that already exists somewhere (a count, a date, a
// seat); the callers read those facts with the helpers each page already uses and pass them in.
// Nothing about a flow is stored except, in the browser, that somebody folded or dismissed it.

/** Every flow and its step keys. Also the allow-list for the analytics beacon: nothing else is recorded. */
export const FLOW_STEP_KEYS = {
  'run-event': ['format', 'tiles', 'signups', 'teams', 'dates', 'start', 'proofs', 'prizes'],
  'clan-setup': ['clan', 'plugin', 'prove', 'members', 'event'],
  'member-start': ['clan', 'plugin', 'character', 'join', 'proof'],
  'clanless-start': ['character', 'clan', 'open'],
  moderator: ['queue', 'decide', 'next'],
} as const;

export type FlowKey = keyof typeof FLOW_STEP_KEYS;

export function isFlowKey(v: unknown): v is FlowKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(FLOW_STEP_KEYS, v);
}

export function isFlowStep(flow: FlowKey, step: unknown): step is string {
  return typeof step === 'string' && (FLOW_STEP_KEYS[flow] as readonly string[]).includes(step);
}

/**
 * Somewhere to go. `href` is a path as ClanLink takes it (relative to the clan where the clan owns
 * it); `anchor` is the id of the exact section or control, which components/HashReveal opens, scrolls
 * to and rings.
 */
export interface FlowLink {
  label: string;
  href: string;
  anchor?: string;
}

export type FlowAction =
  | ({ kind: 'link' } & FlowLink)
  /** Copy a member-facing link (components/CopyLinkButton). */
  | { kind: 'copy'; label: string; path: string }
  /** Something only the page can do (start an event): the page passes the handler. */
  | { kind: 'custom'; label: string; id: string }
  | { kind: 'none' };

export interface FlowBlocked {
  /** What is in the way, as a sentence. */
  reason: string;
  /** The thing that clears it. */
  fix: FlowLink;
}

/** What the open step shows: one sentence, one button, and optionally the written guide behind it. */
export interface FlowStepCopy {
  title: string;
  sentence: string;
  action: FlowAction;
  /** "How this works": the matching section of a written guide. */
  guideHref?: string;
  blocked?: FlowBlocked;
}

export interface FlowStepDef {
  key: string;
  label: string;
  done: boolean;
}

export type FlowStepState = 'done' | 'current' | 'todo';

export interface FlowStepView {
  key: string;
  label: string;
  state: FlowStepState;
}

export interface FlowView {
  key: FlowKey;
  name: string;
  steps: FlowStepView[];
  /** The open step, or null when every step is done. */
  current: (FlowStepCopy & { key: string }) | null;
  /** 1-based position of the open step; 0 when complete. */
  stepNumber: number;
  total: number;
  doneCount: number;
  /** Every step is done. A complete flow is not drawn at all. */
  complete: boolean;
}

/**
 * Which step is open: the first one that is not done. `preferred` names a step chosen by a function
 * that already decides this for the page (lib/eventNextStep), and wins when it is not done.
 */
export function selectCurrent(steps: readonly FlowStepDef[], preferred?: string | null): string | null {
  if (preferred) {
    const hit = steps.find((s) => s.key === preferred);
    if (hit && !hit.done) return hit.key;
  }
  return steps.find((s) => !s.done)?.key ?? null;
}

export function buildFlow(opts: {
  key: FlowKey;
  name: string;
  steps: FlowStepDef[];
  preferred?: string | null;
  describe: (stepKey: string) => FlowStepCopy;
}): FlowView {
  const currentKey = selectCurrent(opts.steps, opts.preferred);
  const steps: FlowStepView[] = opts.steps.map((s) => ({
    key: s.key,
    label: s.label,
    state: s.key === currentKey ? 'current' : s.done ? 'done' : 'todo',
  }));
  const doneCount = opts.steps.filter((s) => s.done).length;
  return {
    key: opts.key,
    name: opts.name,
    steps,
    current: currentKey ? { key: currentKey, ...opts.describe(currentKey) } : null,
    stepNumber: currentKey ? steps.findIndex((s) => s.key === currentKey) + 1 : 0,
    total: steps.length,
    doneCount,
    complete: currentKey === null,
  };
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
