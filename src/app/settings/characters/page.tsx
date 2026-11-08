import { redirect } from 'next/navigation';

import { settingsCharacters } from '@/lib/settingsData';
import { settingsSession } from '@/app/settings/settingsSession';

/**
 * "Your characters" without picking one: your main character's page, or Add a character when there
 * is none. The hub and its search point here (lib/memberSettingsIndex) and normally swap in the real
 * page themselves; this keeps a typed or shared /settings/characters from being a 404.
 */
export default async function CharactersIndex() {
  const session = await settingsSession();
  const characters = session.playerId ? await settingsCharacters(session.playerId) : [];
  redirect(characters[0] ? `/settings/characters/${characters[0].accountId}` : '/settings/add');
}
