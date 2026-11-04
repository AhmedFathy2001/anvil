import RulebookPanel from '../../RulebookPanel';
import { loadSettings } from '../load';

export const dynamic = 'force-dynamic';

/**
 * Settings › Rules: the rules players read and the Discord announcement that carries them, the
 * house-rules addendum, when they post and the shared-account check. Its own tab: on Board & play it
 * was the longest thing on the page and about words, not how the board plays.
 */
export default async function RulesSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { id } = await loadSettings((await params).eventId);
  return (
    <div id="rulebook" className="scroll-mt-28 rounded-xl">
      <RulebookPanel eventId={id} />
    </div>
  );
}
