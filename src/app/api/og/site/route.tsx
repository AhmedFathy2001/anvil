import { siteCard } from '@/lib/ogCard';

/** The platform's own card — what a link to the apex, /clans, /pricing or a guide unfurls as. */
export const dynamic = 'force-static';

export function GET() {
  return siteCard();
}
