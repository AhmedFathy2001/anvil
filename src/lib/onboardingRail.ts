import type { OnboardingIntent, StepKey } from '@/lib/onboarding';

/**
 * What /welcome draws: the rail and its panels. Pure, so the order and the done conditions can be
 * tested without a database (lib/onboarding reads the facts and hands them here).
 *
 * THE PLUGIN IS THE WAY TO LINK A CHARACTER, so there is no character step. Installing the plugin
 * and signing in links the character by itself, and it is also what tracks everything afterwards.
 * The flow used to put "Link your RuneScape account" (the 30-minute XP check) second and the plugin
 * last, so a new person was walked through the fallback before being told about the thing that makes
 * it unnecessary. The XP check is still there, folded inside the plugin step for somebody who cannot
 * run the plugin (a phone, a different client).
 *
 * The four FACTS stay four (lib/onboarding's `steps`): other pages read "has a character" and "the
 * plugin has reported" separately, and the stored skip list is keyed by them.
 */
export type RailKey = 'discord' | 'plugin' | 'clan';

export interface RailStep {
  key: RailKey;
  /** Imperative, because it is a thing to go and do. */
  title: string;
  /** One line under the title. */
  blurb: string;
  done: boolean;
  /** They passed on it. Not done, but not nagged about either. */
  skipped: boolean;
}

const COPY: Record<RailKey, { title: string; blurb: string }> = {
  discord: {
    title: 'Sign in with Discord',
    blurb: 'Done. This is how Anvil knows who you are, and how your clan reaches you.',
  },
  plugin: {
    title: 'Get the Anvil plugin',
    blurb:
      'Install it in RuneLite and sign in. It links your character by itself, and it is what tracks your drops, kills and collection log.',
  },
  clan: {
    title: 'Join a clan, or start one',
    blurb: 'Boards and competitions live in a clan. Turning up with a linked character is most of an application.',
  },
};

/**
 * The plugin step once a character is already linked without it (the XP check). The step is not
 * done, because nothing is tracking them yet, but it must not read as "link your character" again.
 */
const PLUGIN_AFTER_PROOF = {
  title: 'Add the Anvil plugin',
  blurb: 'Your character is linked. The plugin is what tracks it: drops, kills and your collection log all come from it.',
};

/**
 * The clan step, said three ways.
 *
 * The step is one fact — do they hold a seat anywhere — and the three readings of it are genuinely
 * different acts: founding, applying, and declining. Only the clan step differs, because it is the
 * only one whose MEANING changes with why somebody came; a working plugin is the same thing to all
 * three.
 */
const CLAN_COPY: Record<OnboardingIntent, { title: string; blurb: string }> = {
  owner: {
    title: 'Start your clan',
    blurb:
      'Free, and live the moment you press the button — no approval, no payment, no waiting. You own it, and the setup wizard takes it from there.',
  },
  member: {
    title: 'Find your clan',
    blurb:
      'Search the clan you play with and ask to join. Most take guests on approval, so a staff member sees the request and this ticks itself when they say yes.',
  },
  solo: {
    title: 'A clan, if you ever want one',
    blurb:
      'Not needed for any of the above — your log, your records and your profile are yours. Boards and competitions are the part that lives in a clan.',
  },
};

/**
 * The order. Plugin straight after Discord for everyone except an owner: a clan takes a join request
 * from a linked character, so somebody joining needs the plugin first, and somebody here for
 * themselves needs nothing else. An owner came to make a clan, which needs no character, so that
 * leads and the plugin follows.
 */
export function railOrder(intent: OnboardingIntent | null): RailKey[] {
  return intent === 'owner' ? ['discord', 'clan', 'plugin'] : ['discord', 'plugin', 'clan'];
}

export function welcomeRail(
  done: Record<StepKey, boolean>,
  skipped: ReadonlySet<StepKey>,
  intent: OnboardingIntent | null,
): RailStep[] {
  return railOrder(intent).map((key) => {
    // THE PLUGIN STEP IS DONE WHEN THE PLUGIN HAS REPORTED, not when a character exists. Somebody who
    // proved a character by XP has a character and no tracking, and ticking the step for them would
    // hide the one thing still worth doing. The plugin reporting implies the character, so a person
    // who linked through the plugin is never asked to prove it again.
    const isDone = done[key];
    const copy =
      key === 'clan' && intent
        ? CLAN_COPY[intent]
        : key === 'plugin' && done.character && !done.plugin
          ? PLUGIN_AFTER_PROOF
          : COPY[key];
    return {
      key,
      ...copy,
      done: isDone,
      // A step that turned out to be done is not skipped, whatever they pressed. Somebody who skipped
      // "join a clan" and was then added to one by an admin should see it ticked, not passed over.
      //
      // "Just me" IS the clan skip, and it is derived rather than written: saying so on the chooser
      // must not leave a stored skip behind that outlives the answer, so that a person who later
      // changes their mind to 'member' finds the step waiting for them rather than silently passed over.
      skipped: (skipped.has(key as StepKey) || (key === 'clan' && intent === 'solo')) && !isDone,
    };
  });
}

/** The header's numbers, off the rail and not off the facts: "2 of 3" has to count what is drawn. */
export function railProgress(rail: RailStep[]): {
  current: RailKey | null;
  doneCount: number;
  total: number;
  allSettled: boolean;
} {
  const current = rail.find((s) => !s.done && !s.skipped)?.key ?? null;
  return { current, doneCount: rail.filter((s) => s.done).length, total: rail.length, allSettled: current == null };
}
