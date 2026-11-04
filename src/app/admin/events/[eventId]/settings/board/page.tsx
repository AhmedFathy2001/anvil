import SettingsClient from '../SettingsClient';
import { boardTiles, loadSettings } from '../load';

export const dynamic = 'force-dynamic';

/** Settings › Board & play: when tiles are seen and open, the standings curtain, worlds and the rules. */
export default async function BoardSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { id, event } = await loadSettings((await params).eventId);
  return <SettingsClient event={event} tiles={await boardTiles(id)} section="board" />;
}
