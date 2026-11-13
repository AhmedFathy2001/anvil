import { LEGACY_SETTINGS, legacyRedirect } from '../_legacy';

/** Moved: see app/settings/_legacy. */
export default async function Moved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const to = LEGACY_SETTINGS['look'];
  return legacyRedirect(to.page, to.at, searchParams);
}
