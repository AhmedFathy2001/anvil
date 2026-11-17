import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, users } from '@/db/schema';
import { clansOfPerson } from '@/lib/myClans';
import { isCreatorSpace } from '@/lib/creatorSpaces';
import { keepQuickEntries, withQuickSettingsDone } from '@/lib/quickSettings';
import { railProgress, welcomeRail, type RailKey, type RailStep } from '@/lib/onboardingRail';

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
 * 2. A CHARACTER NEEDS NO CLAN. It once did: every path that attached an account to a person ran
 *    through a SEAT. `lib/accountClaim` changed that — proving a character is yours is a fact about
 *    YOU, which `accounts.verifiedAt` has said all along — so the plugin (or the XP check) links a
 *    character for somebody in no clan at all, and linking comes before finding a clan.
 *
 * WHAT THE PAGE DRAWS IS NOT THIS LIST. `steps` are the four facts, which other pages read one at a
 * time (lib/guidedFlowFacts) and which key the stored skip list. /welcome draws `rail`
 * (lib/onboardingRail): three steps, with the plugin as the way a character gets linked.
 */

/** The facts, and the keys of the stored skip list. Not the page's steps — see lib/onboardingRail. */
export type StepKey = 'discord' | 'character' | 'clan' | 'plugin';

/**
 * Why they came — the one thing about a first login that cannot be derived.
 *
 * Everything else in this file is read back off facts that already exist. This cannot be: a person
 * on their first login has no seat, no roster history and no boards, so there is nothing to
 * introspect. Three people arrive in that identical empty state and want three different things,
 * and the flow used to hand all of them the same sentence — "Join a clan, or start one" — as though
 * founding a clan and being let into one were one act.
 *
 *   owner  — they run a clan and are here to put it on Anvil
 *   member — their clan is (or will be) here and they want in
 *   solo   — neither; they want their own collection log, records and boards to play in
 *
 * `null` is "not asked", which every pre-existing row is and stays: somebody a year in does not get
 * a chooser for a question they answered by doing.
 */
export type OnboardingIntent = 'owner' | 'member' | 'solo';

export function isOnboardingIntent(v: string | null | undefined): v is OnboardingIntent {
  return v === 'owner' || v === 'member' || v === 'solo';
}

export interface OnboardingStep {
  key: StepKey;
  done: boolean;
  /** They passed on it. Not done, but not nagged about either. */
  skipped: boolean;
}

export interface OnboardingState {
  /** The four facts, for readers that ask about one of them. /welcome draws `rail` instead. */
  steps: OnboardingStep[];
  /** What /welcome shows, in order (lib/onboardingRail). The numbers below count this. */
  rail: RailStep[];
  /** What they said they were here for, or null when they have not been asked. */
  intent: OnboardingIntent | null;
  /** The first rail step that is neither done nor skipped, or null when there is nothing left. */
  current: RailKey | null;
  doneCount: number;
  total: number;
  /** Every rail step is done or skipped. */
  allSettled: boolean;
  /** They pressed the finish button, or it finished itself. ISO, or null. */
  completedAt: string | null;
  /** Whether the flow should be offered at all — see `shouldOfferOnboarding`. */
  offer: boolean;
}

const STEP_KEYS: StepKey[] = ['discord', 'character', 'clan', 'plugin'];

/** The skipped list, tolerant of anything that is not the JSON array it should be. */
export function parseSkipped(raw: string | null | undefined): StepKey[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((k): k is StepKey => STEP_KEYS.includes(k));
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
    columns: { onboardingCompletedAt: true, onboardingSkipped: true, onboardingIntent: true },
  });
  const intent = isOnboardingIntent(user?.onboardingIntent) ? user.onboardingIntent : null;

  // ONE read for the character and plugin facts, off `accounts` and not off a seat.
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
    // A CLAN, not a creator space: playing a streamer's event (or running a space) is not being in a
    // clan, which is what this step is about.
    clan: myClans.some((c) => !isCreatorSpace({ kind: c.clanKind })),
    character: characters.length > 0,
    plugin: characters.some((a) => a.liveStatsAt != null),
  };

  const skipped = new Set(parseSkipped(user?.onboardingSkipped));

  const steps: OnboardingStep[] = STEP_KEYS.map((key) => ({
    key,
    done: doneOf[key],
    // A step that turned out to be done is not skipped, whatever they pressed. "Just me" IS the clan
    // skip, derived rather than written, so changing the answer later finds the step waiting
    // (the same rule, at length, in lib/onboardingRail).
    skipped: (skipped.has(key) || (key === 'clan' && intent === 'solo')) && !doneOf[key],
  }));

  const rail = welcomeRail(doneOf, skipped, intent);

  return {
    steps,
    rail,
    intent,
    ...railProgress(rail),
    completedAt: user?.onboardingCompletedAt ?? null,
    offer: shouldOfferOnboarding(user?.onboardingCompletedAt ?? null, doneOf, intent),
  };
}

/**
 * Should we send this person to /welcome at all?
 *
 * Not "are they new" — a first login is the common case but not the only one, and somebody who has
 * been signed in for a year with no clan and no character is in exactly the state the flow exists
 * for. What disqualifies them is having FINISHED it, or having nothing left to do.
 *
 * Deliberately does not fire for someone merely missing the plugin: a person in a clan with a
 * linked character who has not installed it has a working account, and redirecting them to a
 * setup flow every login would be nagging, not onboarding. The profile card covers that case.
 */
export function shouldOfferOnboarding(
  completedAt: string | null,
  done: Record<StepKey, boolean>,
  intent: OnboardingIntent | null = null,
): boolean {
  if (completedAt) return false;
  // A person who said "just me" has answered the clan question, and answering it must not leave them
  // permanently qualifying for the flow that asks it. Without this, choosing solo is the one answer
  // the flow refuses to accept: no clan, forever, so offer stays true forever.
  if (intent === 'solo') return !done.character;
  return !done.clan || !done.character;
}

/** Mark the flow finished. Idempotent — pressing it twice keeps the first timestamp. */
export async function completeOnboarding(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date().toISOString() })
    .where(and(eq(users.id, userId), isNull(users.onboardingCompletedAt)));
}

/**
 * Record why somebody says they are here. Changeable: it is an answer, not a role, and the flow
 * offers to change it — a person who came to "just look" and then founded a clan is the ordinary
 * story, not an edge case.
 */
export async function setIntent(userId: number, intent: OnboardingIntent): Promise<void> {
  await db.update(users).set({ onboardingIntent: intent }).where(eq(users.id, userId));
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
  await db.update(users).set({ onboardingSkipped: keepQuickEntries(user?.onboardingSkipped, next) }).where(eq(users.id, userId));
  return next;
}

/**
 * The quick-settings step of a clan's getting-started strip was dealt with (looked good, or skipped):
 * remembered as a `qs:<clanId>` entry in the same list the first-run steps use (lib/quickSettings).
 */
export async function markQuickSettingsDone(userId: number, clanId: number): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { onboardingSkipped: true } });
  await db.update(users).set({ onboardingSkipped: withQuickSettingsDone(user?.onboardingSkipped, clanId) }).where(eq(users.id, userId));
}
