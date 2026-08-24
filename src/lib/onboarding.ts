import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { clansOfPerson } from '@/lib/myClans';

/**
 * First run, for a person.
 *
 * This did not need to exist while a deployment was a clan: you arrived at your clan's site, so
 * there was always a clan, your RSN was already on its roster, and the only thing left was pointing
 * the plugin at it. On one platform the front door is the apex, where a new person has no clan, no
 * character and — until this — nothing telling them what to do next. The apex profile said
 * "Connect the plugin from inside a clan to link one" to people whose whole problem was not being
 * in a clan.
 *
 * TWO RULES SHAPE THE WHOLE FILE.
 *
 * 1. STATE IS DERIVED, NOT STORED. Every step's done-ness is a fact that already exists somewhere —
 *    a seat, an accounts row, a plugin ping. A stored step counter would be a second answer to a
 *    question the data already answers, and the two would drift the first time somebody was added by
 *    an admin, left a clan, or set the plugin up before ever opening this page. Only INTENT is
 *    persisted: that they finished, and which steps they chose to pass on.
 *
 * 2. THE ORDER IS THE MACHINERY'S, NOT A PREFERENCE. It is tempting to put "link your character"
 *    before "join a clan" — it is the smaller ask, and it is what a player thinks they came to do.
 *    It cannot work: an account is claimed through a SEAT (`findOrCreateSeat`), every plugin route
 *    resolves a clan from its Host, and `resolvePluginMember`'s auto-link is clan-scoped throughout.
 *    A flow that offered the character step first would present a door that does not open. So the
 *    clan comes second, and the step says why rather than leaving somebody to discover it.
 *
 *    The step's DONE-ness is still a clan-free question, and that is not a contradiction: getting an
 *    account attached to you goes through a clan, but the account, once attached, is yours and not
 *    any clan's. Which is why the reads below are on `accounts` and not on `clan_roster`.
 */

export type StepKey = 'discord' | 'clan' | 'character' | 'plugin';

export interface OnboardingStep {
  key: StepKey;
  /** Imperative, because it is a thing to go and do. */
  title: string;
  /** One line under the title. */
  blurb: string;
  done: boolean;
  /** They passed on it. Not done, but not nagged about either. */
  skipped: boolean;
  /** Steps whose absence makes this one impossible. Empty for the ones that stand alone. */
  needs: StepKey[];
}

export interface OnboardingState {
  steps: OnboardingStep[];
  /** The first step that is neither done nor skipped, or null when there is nothing left. */
  current: StepKey | null;
  doneCount: number;
  total: number;
  /** Every step is done or skipped. */
  allSettled: boolean;
  /** They pressed the finish button, or it finished itself. ISO, or null. */
  completedAt: string | null;
  /** Whether the flow should be offered at all — see `shouldOfferOnboarding`. */
  offer: boolean;
}

const STEP_COPY: Record<StepKey, { title: string; blurb: string; needs: StepKey[] }> = {
  discord: {
    title: 'Sign in with Discord',
    blurb: 'Done — this is how Anvil knows who you are, and how your clan reaches you.',
    needs: [],
  },
  clan: {
    title: 'Join a clan, or start one',
    blurb:
      'Everything else hangs off this. Boards, competitions and your character all live in a clan, and the plugin needs one to report to.',
    needs: [],
  },
  character: {
    title: 'Link your RuneScape account',
    blurb: 'So a drop, a kill or a level lands on the right person instead of a name that looks like yours.',
    needs: ['clan'],
  },
  plugin: {
    title: 'Let the plugin do the rest',
    blurb: 'Install it in RuneLite once and it fills in every board you ever play, in every clan you are ever in.',
    needs: ['clan', 'character'],
  },
};

/** The skipped list, tolerant of anything that is not the JSON array it should be. */
export function parseSkipped(raw: string | null | undefined): StepKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is StepKey => k in STEP_COPY);
  } catch {
    return [];
  }
}

/**
 * Where this person has got to.
 *
 * `playerId` may be null on a login that predates persons — `verifyUser` self-heals it, so in
 * practice it is set, and the null branch simply reports nothing done rather than throwing.
 */
export async function onboardingState(
  userId: number,
  playerId: number | null,
): Promise<OnboardingState> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { onboardingCompletedAt: true, onboardingSkipped: true },
  });

  // ONE read for the last two steps, off `accounts` and not off a seat.
  //
  // `live_stats_at` lives on the ACCOUNT, not on the membership, because Jagex tracks accounts and
  // not memberships — it is what lets the hiscores sweep poll somebody in three clans once instead
  // of three times. Reading it here through clan_roster would have been a clan-scoped question
  // asked on a page that has no clan, to learn a fact that was never a clan's in the first place.
  const [myClans, myAccounts] = await Promise.all([
    playerId == null ? Promise.resolve([]) : clansOfPerson(playerId, userId),
    playerId == null
      ? Promise.resolve([])
      : db
          .select({ id: accounts.id, rsn: accounts.rsn, liveStatsAt: accounts.liveStatsAt })
          .from(accounts)
          .where(eq(accounts.playerId, playerId)),
  ]);

  // Legacy federation anchors are not characters — rows a removed feature left behind.
  const characters = myAccounts.filter((a) => !a.rsn.startsWith('guest:'));

  const doneOf: Record<StepKey, boolean> = {
    discord: true,
    clan: myClans.length > 0,
    character: characters.length > 0,
    plugin: characters.some((a) => a.liveStatsAt != null),
  };

  const skipped = new Set(parseSkipped(user?.onboardingSkipped));

  const steps: OnboardingStep[] = (Object.keys(STEP_COPY) as StepKey[]).map((key) => ({
    key,
    ...STEP_COPY[key],
    done: doneOf[key],
    // A step that turned out to be done is not skipped, whatever they pressed. Somebody who skipped
    // "join a clan" and was then added to one by an admin should see it ticked, not passed over.
    skipped: skipped.has(key) && !doneOf[key],
  }));

  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done && !s.skipped)?.key ?? null;

  return {
    steps,
    current,
    doneCount,
    total: steps.length,
    allSettled: current == null,
    completedAt: user?.onboardingCompletedAt ?? null,
    offer: shouldOfferOnboarding(user?.onboardingCompletedAt ?? null, doneOf),
  };
}

/**
 * Should we send this person to /welcome at all?
 *
 * Not "are they new" — a first login is the common case but not the only one, and somebody who has
 * been signed in for a year with no clan and no character is in exactly the state the flow exists
 * for. What disqualifies them is having FINISHED it, or having nothing left to do.
 *
 * Deliberately does not fire for someone merely missing the last step: a person in a clan with a
 * linked character who has not installed the plugin has a working account, and redirecting them to a
 * setup flow every login would be nagging, not onboarding. The profile card covers that case.
 */
export function shouldOfferOnboarding(
  completedAt: string | null,
  done: Record<StepKey, boolean>,
): boolean {
  if (completedAt) return false;
  return !done.clan || !done.character;
}

/** Mark the flow finished. Idempotent — pressing it twice keeps the first timestamp. */
export async function completeOnboarding(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date().toISOString() })
    .where(and(eq(users.id, userId), isNull(users.onboardingCompletedAt)));
}

/** Pass on a step, or take it back. Stored as a set so pressing skip twice is not two entries. */
export async function setSkipped(userId: number, key: StepKey, skipped: boolean): Promise<StepKey[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { onboardingSkipped: true },
  });
  const set = new Set(parseSkipped(user?.onboardingSkipped));
  if (skipped) set.add(key);
  else set.delete(key);
  const next = [...set];
  await db.update(users).set({ onboardingSkipped: JSON.stringify(next) }).where(eq(users.id, userId));
  return next;
}
