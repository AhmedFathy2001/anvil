// Where the clan switcher lands. The same kind of page in the other clan when it exists there
// (weekly, members, events list, an admin section), otherwise that clan's home.
import { clanBasePath, stripClanPrefix } from '@/lib/clanScopedPaths';

export interface SwitchTarget {
  slug: string;
  kind?: string | null;
  role?: string | null;
}

/** Roles that can open the full admin area of a clan. */
const ADMIN_ROLES = new Set(['owner', 'admin']);

/**
 * @param currentPath the path the person is on (with or without a clan prefix)
 * @param target the clan they are switching to
 */
export function switchTargetPath(currentPath: string, target: SwitchTarget): string {
  const base = clanBasePath(target);
  const inner = stripClanPrefix(currentPath.split(/[?#]/)[0]).replace(/\/+$/, '') || '/';
  const space = target.kind === 'creator';
  const first = inner.split('/')[1] ?? '';

  if (first === 'events') return `${base}/events`;
  if (space) return base;
  if (first === 'weekly') return `${base}/weekly`;
  if (first === 'members') return `${base}/members`;
  if (first === 'admin') {
    const section = inner.split('/')[2];
    if (section && target.role && ADMIN_ROLES.has(target.role)) return `${base}/admin/${section}`;
  }
  return base;
}
