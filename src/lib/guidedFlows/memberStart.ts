// Flows c and d: a player getting started. One for somebody in a clan (or joining one), one for
// somebody in none.
//
// Every fact is one the site already works out: the first three come from lib/onboarding (a seat, a
// character, a plugin report), the fourth from the same count the "My Team" link uses, and the last
// is "has a proof of theirs ever landed". lib/guidedFlowFacts reads them; nothing is stored.
//
// Pure (no `@/` imports): tests/guided-flows.test.ts runs it directly.

import { xpCheckLine, type PendingXpCheck } from '../xpCheck.ts';
import type { QuickSettingsView } from '../quickSettings.ts';
import { buildFlow, type FlowStepCopy, type FlowStepDef, type FlowView } from '../guidedFlow.ts';

export const MEMBER_START_NAME = 'Getting started';
export const CLANLESS_START_NAME = 'Getting started';

/** Where a character is linked: the same control the home page and the settings page point at. */
const LINK_CHARACTER = { href: '/settings/characters', anchor: 'link-account' } as const;

export interface MemberStartFacts {
  /** Holds a member seat in a clan (lib/onboarding's clan step). */
  inClan: boolean;
  /** A character of theirs has reported in through the plugin (lib/onboarding's plugin step). */
  pluginConnected: boolean;
  /** At least one character is linked to them. */
  hasCharacter: boolean;
  /** On a team, or signed up, for something that has not ended (lib/myTeamNav). */
  inEvent: boolean;
  /** A proof of theirs has landed on a board, by the plugin or by hand. */
  hasProof: boolean;
  /** A character's XP check is running (lib/xpCheck): the character step says so. */
  xpCheck?: Pick<PendingXpCheck, 'rsn' | 'minutesLeft'> | null;
  /**
   * The quick switches for the clan they are in (lib/quickSettingsRead); absent or null when there is
   * nothing to ask, or it was already dealt with, and the step then counts as done.
   */
  quick?: QuickSettingsView | null;
  /**
   * Where this clan's events and their team page are, when the strip is drawn outside the clan (the
   * platform home): there the bare paths belong to no clan. Inside a clan the defaults are right.
   */
  eventsHref?: string;
  teamHref?: string;
}

export function memberStartFlow(f: MemberStartFacts): FlowView {
  // A first proof is the end of getting started, however they got there: somebody who uploads
  // screenshots by hand has a working account, and a guide that kept asking for the plugin would be
  // nagging. The profile's own plugin card covers that.
  const done = (fact: boolean) => fact || f.hasProof;
  const steps: FlowStepDef[] = [
    { key: 'clan', label: 'Join a clan', done: done(f.inClan) },
    // Done once it was dealt with, or when there is nothing to ask. Never before they are in a clan.
    { key: 'settings', label: 'Quick settings', done: done(f.inClan && !f.quick) },
    { key: 'plugin', label: 'Plugin', done: done(f.pluginConnected) },
    { key: 'character', label: 'Character', done: done(f.hasCharacter) },
    { key: 'join', label: 'Join an event', done: done(f.inEvent) },
    { key: 'proof', label: 'First proof', done: f.hasProof },
  ];

  const describe = (key: string): FlowStepCopy => {
    switch (key) {
      case 'clan':
        return {
          title: 'Join your clan',
          sentence:
            'Find the clan you play with and ask to join; someone on its staff approves the request, and this step ticks itself when they do.',
          action: { kind: 'link', label: 'Find your clan', href: '/clans' },
          // Clans take requests from a linked character only, and the apply button says so without
          // saying where to link one.
          ...(f.hasCharacter
            ? {}
            : {
                blocked: {
                  reason: 'A clan can only take a request from a linked character, so link yours first.',
                  fix: { label: 'Link a character', ...LINK_CHARACTER },
                },
              }),
        };
      case 'settings':
        return {
          title: 'Quick settings',
          sentence: f.quick
            ? f.quick.seat === 'member'
              ? `A few choices worth making now you are in ${f.quick.clanName}. Each one saves as soon as you press it.`
              : `A few choices worth making now you are a guest in ${f.quick.clanName}. Each one saves as soon as you press it.`
            : 'A few choices worth making once you are in a clan.',
          action: { kind: 'none' },
          ...(f.quick ? { quick: f.quick } : {}),
        };
      case 'plugin':
        return {
          title: 'Install the plugin and sign in',
          sentence:
            'In RuneLite, install Anvil from the Plugin Hub, open its panel from the side strip and press Sign in with Discord, so your kills and drops count without screenshots.',
          action: { kind: 'link', label: 'Open plugin setup', href: '/profile', anchor: 'connect-plugin' },
          guideHref: '/guide/plugin#install',
        };
      case 'character':
        return {
          title: 'Link your character',
          sentence: f.xpCheck
            ? `${xpCheckLine(f.xpCheck)} Open it to finish.`
            : 'Log in to the game with the plugin signed in and your character links itself; if it does not show up, add it by hand with Verify by XP.',
          action: { kind: 'link', label: f.xpCheck ? 'Open the check' : 'Link a character', ...LINK_CHARACTER },
          guideHref: '/guide/plugin#accounts',
        };
      case 'join':
        return {
          title: 'Join an event or a team',
          sentence:
            'Open Competitions and sign up for an event, or ask a captain to put you on their team, so your progress has a board to count on.',
          action: { kind: 'link', label: 'See events', href: f.eventsHref ?? '/events' },
          guideHref: '/guide/team-competitions',
        };
      default:
        return {
          title: 'Send your first proof',
          sentence:
            'Most tiles count by themselves through the plugin; for one that needs a screenshot, the proof form is on your team page: open the tile there and upload it.',
          action: { kind: 'link', label: 'Open my team', href: f.teamHref ?? '/team' },
          guideHref: '/guide/plugin#bingo',
        };
    }
  };

  return buildFlow({ key: 'member-start', name: MEMBER_START_NAME, steps, describe });
}

export interface ClanlessStartFacts {
  hasCharacter: boolean;
  /** A character's XP check is running (lib/xpCheck): the character step says so. */
  xpCheck?: Pick<PendingXpCheck, 'rsn' | 'minutesLeft'> | null;
  /** Holds a member seat in a clan. */
  inClan: boolean;
  /** They said they are here on their own, or passed on the clan step (lib/onboarding). */
  clanSkipped: boolean;
  /** Why they came, when they said (lib/onboarding): it decides which door the clan step opens. */
  intent: 'owner' | 'member' | 'solo' | null;
  /** On a team, or signed up, for something that has not ended; or a proof of theirs has landed. */
  inEvent: boolean;
  /** Public events on their home page right now (lib/apexHome discover); null when this page did not load them. */
  openEvents: number | null;
}

export function clanlessStartFlow(f: ClanlessStartFacts): FlowView {
  // The character comes first: it is the smaller ask, it needs no clan, and a clan only takes a
  // request from a linked character.
  const steps: FlowStepDef[] = [
    { key: 'character', label: 'Link a character', done: f.hasCharacter },
    { key: 'clan', label: f.intent === 'owner' ? 'Start a clan' : 'Find a clan', done: f.inClan || f.clanSkipped },
    { key: 'open', label: 'Open to everyone', done: f.inEvent },
  ];

  const describe = (key: string): FlowStepCopy => {
    switch (key) {
      case 'character':
        return {
          title: 'Link your character',
          sentence: f.xpCheck
            ? `${xpCheckLine(f.xpCheck)} Open it to finish.`
            : 'Link the character you play and Anvil tracks its XP, kills and collection log from then on; it stays yours in every clan you join, with no clan needed.',
          action: { kind: 'link', label: f.xpCheck ? 'Open the check' : 'Link a character', ...LINK_CHARACTER },
          guideHref: '/guide/plugin#accounts',
        };
      case 'clan':
        if (f.intent === 'owner') {
          return {
            title: 'Start your clan',
            sentence: 'Starting a clan is free and it is live the moment you create it; you own it, and a setup guide takes it from there.',
            action: { kind: 'link', label: 'Start a clan', href: '/clans/new' },
            guideHref: '/guide/clan#create',
          };
        }
        return {
          title: 'Find your clan, or start one',
          sentence:
            'Search for the clan you play with and ask to join; its staff approve the request and this step ticks itself. Running your own is free too.',
          action: { kind: 'link', label: 'Find your clan', href: '/clans' },
          guideHref: '/guide/clan#before',
        };
      default:
        if (f.openEvents === 0) {
          return {
            title: 'See what is open to everyone',
            sentence:
              'No public event is running right now; they are listed on your home page when one is, and the clans taking members are one click away.',
            action: { kind: 'link', label: 'Browse clans', href: '/clans' },
          };
        }
        return {
          title: 'See what is open to everyone',
          sentence:
            f.openEvents == null
              ? 'You do not need a clan to play: public events any player can join are listed on your home page, and signing up for one puts you on its board.'
              : `You do not need a clan to play: ${f.openEvents === 1 ? 'one public event is' : `${f.openEvents} public events are`} listed on this page, and signing up for one puts you on its board.`,
          action: { kind: 'link', label: 'Show open events', href: '/', anchor: 'open-events' },
        };
    }
  };

  return buildFlow({ key: 'clanless-start', name: CLANLESS_START_NAME, steps, describe });
}
