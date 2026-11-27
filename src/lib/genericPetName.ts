// The names that mean "a pet, nobody knows which" (lib/petName). Its own module, with no game data,
// so the Discord embed builder and the SQL in momentsStore can share it without the drop dataset.

export const GENERIC_PET_NAMES: readonly string[] = ['', 'pet', 'a pet', 'pet drop', 'pet drop!', 'unknown pet', 'duplicate pet'];

const GENERIC = new Set(GENERIC_PET_NAMES);

export function isGenericPetName(name: string | null | undefined): boolean {
  return GENERIC.has((name ?? '').trim().toLowerCase());
}
