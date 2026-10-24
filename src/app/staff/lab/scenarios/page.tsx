import ClanLink from '@/components/ClanLink';

import ScenariosClient from './ScenariosClient';

export const dynamic = 'force-dynamic';

/**
 * Replay scenarios: scripted game events the plugin's dev-client harness plays into the real plugin
 * (`::anvil sync` pulls these; lib/labScenarios). A 2,000-kc pet is one chat line.
 */
export default function StaffLabScenariosPage() {
  return (
    <div>
      <p className="mb-2 text-sm">
        <ClanLink href="/staff/lab" className="text-text-muted hover:text-gold">← Tile lab</ClanLink>
      </p>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-gold">
        <span className="h-6 w-1 rounded-full bg-gold" />
        Replay scenarios
      </h1>
      <p className="mb-6 text-sm text-text-muted">
        Run the dev client (<code className="text-gray-300">./gradlew runClient</code> in the plugin), then{' '}
        <code className="text-gray-300">::anvil sync</code> and <code className="text-gray-300">::anvil run &lt;name&gt; key=value</code>.
        Replayed pushes only ever credit lab boards.
      </p>
      <ScenariosClient />
    </div>
  );
}
