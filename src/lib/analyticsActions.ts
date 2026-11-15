// The actions worth counting, as a runtime list the type is read off.
//
// A closed list rather than free strings, so a typo is a type error instead of a second, quietly
// empty row on the dashboard. PURE (no database) so the feature registry and its tests can check
// every name they use against it; lib/analytics re-exports the type.

export const ACTION_NAMES = [
  'clan.created',
  'creator.created',
  'event.created',
  'event.cloned',
  'event.started',
  'tile.created',
  'tiles.imported',
  'draft.started',
  'draft.pick',
  'signup.submitted',
  'submission.created',
  'submission.removed',
  'weekly.created',
  'guide.created',
  'guide.copied',
  'auth.login',
  'plugin.linked',
  'profile.synced',
  // A Join button pressed on a Discord card (props.src: which surface — api/discord/join).
  'discord.join',
  // Funnel steps recorded where the action happens (server routes/webhooks), for the owner funnels.
  'discord.connected',
  'roster.synced',
  'supporter.viewed',
  'supporter.checkout',
  'supporter.purchased',
  'clan.purchased',
  'invite.opened',
  'invite.joined',
  // Feature use (lib/featureRegistry): one per thing happening, recorded at the server route.
  'weekly.joined',
  'weekly.optedout',
  'challenge.sent',
  'challenge.accepted',
  'coffer.donated',
  'fee.paid',
  'proof.reviewed',
  'team.balanced',
  'board.library',
  'tasks.drawn',
  'survey.answered',
  'discord.posted',
  'payout.paid',
  // Creation-flow steps recorded where the page is served (lib/analyticsFunnels NEW_EVENT_FLOW etc.).
  'flow.event.picker',
  'flow.event.form',
  'flow.first.opened',
  'flow.setup.opened',
] as const;

export type ActionName = (typeof ACTION_NAMES)[number];
