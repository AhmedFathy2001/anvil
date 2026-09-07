import { ogCard } from '@/lib/ogCard';
import { DEFAULT_DESCRIPTION } from '@/lib/seo';

/** The platform's own card — what a link to the apex, /clans, /pricing or a guide unfurls as. */
export const dynamic = 'force-static';

export function GET() {
  return ogCard({
    eyebrow: 'OSRS Clan Events',
    title: 'Anvil',
    subtitle: DEFAULT_DESCRIPTION,
  });
}
