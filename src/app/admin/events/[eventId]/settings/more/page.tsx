import SaveAsPresetButton from '@/components/SaveAsPresetButton';
import { getBoard } from '@/lib/libraryBoards';
import BoardLibraryPanel from '../BoardLibraryPanel';
import SettingsClient from '../SettingsClient';
import { boardTiles, loadSettings } from '../load';
import SettingsCard from '../SettingsCard';

export const dynamic = 'force-dynamic';

/** Settings › More: run it again (clone, template), share it, repair it, and the danger zone. */
export default async function MoreSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { id, event, isAdmin } = await loadSettings((await params).eventId);
  const [tiles, sourceBoard] = await Promise.all([boardTiles(id), event.libraryBoardId ? getBoard(event.libraryBoardId) : Promise.resolve(null)]);
  return (
    <>
      {isAdmin && (
        <div id="template" className="scroll-mt-28 rounded-xl">
          <SettingsCard title="Save as a template" description="Keeps the type, size and every tile, so you can start an identical board from New event.">
            <SaveAsPresetButton eventId={event.id} defaultName={event.name} />
          </SettingsCard>
        </div>
      )}
      {isAdmin && (
        <div id="library" className="scroll-mt-28 rounded-xl">
          <BoardLibraryPanel
            eventId={event.id}
            eventName={event.name}
            source={sourceBoard ? { id: sourceBoard.id, title: sourceBoard.title, origin: sourceBoard.origin } : null}
          />
        </div>
      )}
      <SettingsClient event={event} tiles={tiles} section="more" />
    </>
  );
}
