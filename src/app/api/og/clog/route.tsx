import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { accounts, memberClogItems } from '@/db/schema';
import { clogPageIndex, clogPageItems } from '@/lib/clogDataset';
import { clogGridImage, verifyClogImageQuery } from '@/lib/clogImage';

export const dynamic = 'force-dynamic';

/**
 * One account's collection-log page as a grid image — the picture on a /stats clog reply.
 *
 * Only answers a URL the bot signed (lib/clogImage), so it is not a way to read anybody's log by
 * guessing ids. The page must be a real log page: the name is looked up in the dataset, never drawn
 * from the query as free text.
 */
export async function GET(request: Request) {
  const signed = verifyClogImageQuery(new URL(request.url).searchParams);
  if (!signed) return new Response('Not found', { status: 404 });
  const catalogue = clogPageItems(signed.page);
  if (catalogue.length === 0) return new Response('Not found', { status: 404 });

  // clan-scope: global -- the account is named by a signature only the bot can mint; a log is the account's, not a seat's.
  const [account] = await db.select({ rsn: accounts.rsn }).from(accounts).where(eq(accounts.id, signed.accountId)).limit(1);
  if (!account) return new Response('Not found', { status: 404 });

  const pageIds = clogPageIndex().get(signed.page) ?? new Set<number>();
  // clan-scope: global -- same account, same signature.
  const owned = await db
    .select({ itemId: memberClogItems.itemId, quantity: memberClogItems.quantity })
    .from(memberClogItems)
    .where(eq(memberClogItems.accountId, signed.accountId));
  const qty = new Map<number, number>();
  for (const r of owned) if (pageIds.has(r.itemId)) qty.set(r.itemId, Math.max(qty.get(r.itemId) ?? 0, r.quantity));

  const image = clogGridImage({
    title: account.rsn,
    page: signed.page,
    slots: catalogue.map((it) => ({ id: it.id, name: it.name, quantity: qty.get(it.id) ?? 0 })),
  });
  // The URL carries the sync stamp, so a given URL's picture never changes — cache it hard.
  image.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400, immutable');
  return image;
}
