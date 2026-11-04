// Who sees which admin settings in the search — the impure half of lib/adminSettingsIndex.
//
// Built from the SAME rules the admin area enforces: `redirectFor` is the layout's path gate, and the
// treasurer check mirrors lib/auth `verifyFeeCollector` (treasurer and moderator tie on rank, so a
// plain rank comparison would hand a moderator the coffer).

import { redirectFor, type AdminAccess } from '@/lib/adminAccess';
import type { SettingRole, SettingsViewer } from '@/lib/adminSettingsIndex';
import { atLeast } from '@/lib/clanRoles';
import { creatorHidesAdminPath } from '@/lib/creatorSpaces';
import type { FeatureKey } from '@/lib/features';

export function settingsViewer(
  access: AdminAccess,
  enabledFeatures: readonly FeatureKey[],
  /** A creator space: the in-game-clan pages are not reachable there (lib/creatorSpaces). */
  creator = false,
): SettingsViewer {
  const on = new Set(enabledFeatures);
  return {
    canReach: (path) => redirectFor(path, access) === null && !(creator && creatorHidesAdminPath(path)),
    hasRole: (min: SettingRole) =>
      min === 'treasurer' ? access.role === 'treasurer' || atLeast(access.role, 'admin') : atLeast(access.role, min),
    featureOn: (key) => on.has(key),
  };
}
