// What a co-host clan may do with the host's tiles, action by action: suggest new ones, add them,
// change existing ones, delete them — and for each, who in that clan may. The host decides per
// co-host (event_cohosts.board_access). Before this there was one switch, `staff_can_edit_board`;
// a co-host row with nothing stored reads from it, and every write keeps it in step for the code
// that still asks the old question.
//
// Pure (no db).

export type TileAction = 'suggest' | 'create' | 'edit' | 'delete';
export const TILE_ACTIONS: readonly TileAction[] = ['suggest', 'create', 'edit', 'delete'];

/** nobody · the clan's staff (moderators and up, and its tile editors) · any of its players. */
export type AccessWho = 'nobody' | 'staff' | 'players';

export type BoardAccess = Record<TileAction, AccessWho>;

export const NO_ACCESS: BoardAccess = { suggest: 'nobody', create: 'nobody', edit: 'nobody', delete: 'nobody' };

const WHO = new Set<string>(['nobody', 'staff', 'players']);

/** Stored access, or what the old single switch meant. Only suggestions may be opened to players. */
export function parseBoardAccess(raw: unknown, legacyStaffCanEdit: boolean): BoardAccess {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  if (!TILE_ACTIONS.some((a) => a in o)) {
    return legacyStaffCanEdit ? { suggest: 'staff', create: 'staff', edit: 'staff', delete: 'staff' } : { ...NO_ACCESS };
  }
  const out = { ...NO_ACCESS };
  for (const a of TILE_ACTIONS) {
    const v = o[a];
    if (typeof v !== 'string' || !WHO.has(v)) continue;
    out[a] = v === 'players' && a !== 'suggest' ? 'staff' : (v as AccessWho);
  }
  return out;
}

/** The old switch, derived: may this clan's staff change the board at all? */
export function staffCanEditFrom(access: BoardAccess): boolean {
  return access.create !== 'nobody' || access.edit !== 'nobody' || access.delete !== 'nobody';
}

/** Does someone of this standing in the co-host clan get to do this? */
export function allows(access: BoardAccess, action: TileAction, isStaff: boolean): boolean {
  const who = access[action];
  if (who === 'nobody') return false;
  if (who === 'players') return true;
  return isStaff;
}

/** Presets for the host's picker. */
export const ACCESS_PRESETS: { id: string; label: string; access: BoardAccess }[] = [
  { id: 'none', label: 'Can’t touch the tiles', access: { ...NO_ACCESS } },
  { id: 'suggest', label: 'Staff can suggest tiles', access: { ...NO_ACCESS, suggest: 'staff' } },
  { id: 'suggestAll', label: 'Anyone in their clan can suggest', access: { ...NO_ACCESS, suggest: 'players' } },
  { id: 'edit', label: 'Staff can suggest and edit, not add or delete', access: { suggest: 'staff', create: 'nobody', edit: 'staff', delete: 'nobody' } },
  { id: 'full', label: 'Staff can do everything', access: { suggest: 'staff', create: 'staff', edit: 'staff', delete: 'staff' } },
];
