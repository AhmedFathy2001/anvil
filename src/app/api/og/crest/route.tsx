import { requireClanFromRequest } from '@/lib/clanContext';
import { crestImage } from '@/lib/crestImage';

export const dynamic = 'force-dynamic';

/**
 * The clan's crest for the CURRENT HOST — used as the author icon on the clan-command embeds, which
 * run in the clan's own request context (so its origin resolves the right clan here).
 *
 * NO CALLER-SUPPLIED TEXT: the name is the clan this host resolves to, never a query parameter — the
 * same rule ogCard follows, so this can't become an open text-render endpoint on a clan's domain.
 * See crestImage for how the mark is drawn (the by-slug variant lives at ./[slug]).
 */
export async function GET(request: Request) {
  let name = 'Anvil';
  try {
    name = (await requireClanFromRequest(request)).name || 'Anvil';
  } catch {
    // Unknown host (the apex, or a clan with no site of its own) — a neutral mark beats erroring,
    // so an embed that points here never shows a broken image.
  }
  return crestImage(name);
}
