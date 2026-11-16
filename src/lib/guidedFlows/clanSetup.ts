// Flow b: a new clan owner, from the clan existing to its first event.
//
// Built on lib/setupStatus: every fact here is one getSetupStatus already reads, so the dashboard,
// the admin sidebar and /admin/setup all show the same steps and the same count. Once the first
// event exists this flow is finished and the event's own guide (./runEvent) takes over.
//
// Pure (no `@/` imports): tests/guided-flows.test.ts runs it directly.

import { buildFlow, type FlowStepCopy, type FlowStepDef, type FlowView } from '../guidedFlow.ts';

export const CLAN_SETUP_NAME = 'Set up your clan';

export interface ClanSetupFacts {
  /** The clan's display name (clans.name). */
  clanName: string;
  /** The exact in-game clan name. The plugin's roster push is matched against it. */
  inGameClanName: string;
  /** Somebody who runs this clan has the plugin signed in (a character of theirs has reported in). */
  pluginSeen: boolean;
  /** A roster push proved this is the in-game clan it names (lib/clanVerification). */
  verified: boolean;
  /** Live member seats. The owner alone is 1, so "loaded" means more than that. */
  memberCount: number;
  /** The clan has at least one event. */
  hasEvent: boolean;
}

export function clanSetupFlow(f: ClanSetupFacts): FlowView {
  const named = !!f.clanName.trim();
  const inGame = f.inGameClanName.trim();
  const membersIn = f.memberCount > 1;
  const steps: FlowStepDef[] = [
    { key: 'clan', label: 'Clan', done: named },
    // A verified name or a loaded roster can only have come from the plugin, so either one counts.
    { key: 'plugin', label: 'Plugin', done: f.pluginSeen || f.verified || membersIn },
    { key: 'prove', label: 'Prove it is yours', done: f.verified },
    { key: 'members', label: 'Members', done: membersIn },
    { key: 'event', label: 'First event', done: f.hasEvent },
  ];

  const describe = (key: string): FlowStepCopy => {
    switch (key) {
      case 'clan':
        return {
          title: 'Name your clan',
          sentence:
            'Give the clan the name people will see, and its exact in-game clan name, which is how the plugin finds your members.',
          action: { kind: 'link', label: 'Open clan details', href: '/admin/setup?step=clan' },
          guideHref: '/guide/clan#setup',
        };
      case 'plugin':
        return {
          title: 'Connect the plugin',
          sentence:
            'Install Anvil from the RuneLite Plugin Hub and press Sign in with Discord in its side panel, so Anvil can see your clan in game.',
          action: { kind: 'link', label: 'Show me the steps', href: '/admin/setup?step=game' },
          guideHref: '/guide/plugin#install',
        };
      case 'prove':
        return {
          title: 'Prove the clan is yours',
          sentence: inGame
            ? `Log in to the game, open your clan window and press the Anvil button: that proves "${inGame}" is yours, so nobody else can claim the name.`
            : 'Log in to the game, open your clan window and press the Anvil button: that proves the clan is yours, so nobody else can claim the name.',
          action: { kind: 'link', label: 'Show me the steps', href: '/admin/setup?step=game' },
          guideHref: '/guide/admin#roster',
          // The roster push is matched against the in-game name. Without one it is refused, and the
          // game gives no sign of that.
          ...(inGame
            ? {}
            : {
                blocked: {
                  reason: 'Anvil has no in-game clan name for this clan yet, so the plugin has nothing to match and the button will do nothing.',
                  fix: { label: 'Add the in-game name', href: '/admin/setup?step=clan' },
                },
              }),
        };
      case 'members':
        return {
          title: 'Bring your members in',
          sentence:
            'Press the Anvil button in your clan window to load the member list. That is how your clanmates become members; anyone else can still sign up for your events as a guest.',
          action: { kind: 'link', label: 'Show me the steps', href: '/admin/setup?step=game' },
          guideHref: '/guide/admin#roster',
        };
      default:
        return {
          title: 'Create your first event',
          sentence: 'Pick a format and give it a name; the event then has its own guide for tiles, teams and dates.',
          action: { kind: 'link', label: 'Create an event', href: '/admin/events/first' },
          guideHref: '/guide/admin#board',
        };
    }
  };

  return buildFlow({ key: 'clan-setup', name: CLAN_SETUP_NAME, steps, describe });
}
