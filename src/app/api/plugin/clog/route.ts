import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { memberClog, memberClogItems, memberClogKc } from '@/db/schema';
import { resolvePluginMember } from '@/lib/auth';
import { clogPageIndex } from '@/lib/clogDataset';

// Collection-log ingest. The plugin sends pages the player has actually OPENED — the game only hands
// the client a page once it has drawn one — so a log arrives in pieces over days rather than whole.
// Everything here is written to survive that: pages replace independently, the header counts distinct
// pages ever seen, and re-sending an unchanged page is a no-op the plugin avoids anyway.
//
// Only OBTAINED items travel. The full 1,712-item catalogue ships in src/data/clog.json, so storing
// the missing half would triple the table to record absence.
//
// Profile data only — never scoring. In particular the killcount lines are display and luck maths;
// crediting a kill tile from them would double-count against the chat line that already does it.

/** A page can't legitimately carry more than this; anything larger is a malformed client. */
const MAX_PAGES_PER_PUSH = 40;
const MAX_ITEMS_PER_PAGE = 200;
const MAX_COUNT = 100_000_000;

interface IncomingItem {
  id?: unknown;
  q?: unknown;
}
interface IncomingPage {
  name?: unknown;
  obtained?: unknown;
  total?: unknown;
  items?: unknown;
  counts?: unknown;
}

const int = (v: unknown, max: number): number | null => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max) return null;
  return Math.floor(v);
};

export async function POST(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide Authorization: Bearer <accountToken> + X-RSN' },
      { status: 401 },
    );
  }

  let body: { pages?: unknown; syncedPages?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body?.pages) || body.pages.length === 0) {
    return NextResponse.json({ error: 'pages[] required' }, { status: 400 });
  }
  if (body.pages.length > MAX_PAGES_PER_PUSH) {
    return NextResponse.json({ error: `At most ${MAX_PAGES_PER_PUSH} pages per push` }, { status: 400 });
  }

  const index = clogPageIndex();
  const nowIso = new Date().toISOString();
  const pluginVersion = request.headers.get('X-Anvil-Plugin-Version')?.slice(0, 32) ?? null;
  const accountHash = request.headers.get('X-Account-Hash')?.slice(0, 128) ?? null;

  let pagesWritten = 0;
  let itemsWritten = 0;
  /** Pages we refused because our catalogue disagreed with the client's — surfaced in the reply. */
  let skippedPages = 0;

  for (const raw of body.pages as IncomingPage[]) {
    const name = typeof raw?.name === 'string' ? raw.name.trim().slice(0, 120) : '';
    // Unknown page names are dropped rather than stored: the catalogue is what the profile renders
    // from, so a page we can't place would be invisible data — and a typo'd or spoofed name would
    // sit in the table forever. A genuinely new page means the dataset needs a rebuild.
    if (!name || !index.has(name)) continue;

    const obtained = int(raw?.obtained, MAX_ITEMS_PER_PAGE);
    const total = int(raw?.total, MAX_ITEMS_PER_PAGE);
    if (obtained == null || total == null || total === 0) continue;

    const items = Array.isArray(raw?.items) ? (raw.items as IncomingItem[]) : [];
    if (items.length > MAX_ITEMS_PER_PAGE) continue;

    const known = index.get(name)!;
    const rows: { itemId: number; quantity: number }[] = [];
    const seen = new Set<number>();
    for (const item of items) {
      const itemId = int(item?.id, 100_000_000);
      if (itemId == null || seen.has(itemId)) continue;
      // The item must actually belong to this page. Without the check, one bad push could file any
      // item id anywhere and every "who has this" board would inherit the mistake.
      if (!known.has(itemId)) continue;
      seen.add(itemId);
      rows.push({ itemId, quantity: Math.max(1, int(item?.q, MAX_COUNT) ?? 1) });
    }

    // The client's own count is the authority, and it has already checked it against the log's
    // "Obtained: N" line before sending. If OUR catalogue can't account for the same number, the two
    // disagree about what this page contains — a game update that added an item, most likely — and
    // the honest move is to leave what we have alone.
    //
    // Skipping rather than committing is the difference between "this page is a bit stale" and
    // "this member's page was deleted because we didn't recognise the new drop".
    if (rows.length !== obtained) {
      skippedPages++;
      continue;
    }

    // Replace the page: an item can leave a log page when Jagex reworks it, and a diff would leave
    // the stale row behind forever. Scoped to this page so other pages are untouched.
    const existing = await db
      .select({ itemId: memberClogItems.itemId, firstSeenAt: memberClogItems.firstSeenAt, kcAtUnlock: memberClogItems.kcAtUnlock })
      .from(memberClogItems)
      .where(and(eq(memberClogItems.clanMemberId, member.clanMemberId), eq(memberClogItems.pageName, name)));
    const previous = new Map(existing.map((r) => [r.itemId, r]));

    await db
      .delete(memberClogItems)
      .where(and(eq(memberClogItems.clanMemberId, member.clanMemberId), eq(memberClogItems.pageName, name)));

    if (rows.length > 0) {
      await db.insert(memberClogItems).values(
        rows.map((r) => {
          const before = previous.get(r.itemId);
          return {
            clanMemberId: member.clanMemberId,
            itemId: r.itemId,
            pageName: name,
            quantity: r.quantity,
            // Preserve when we first saw it; a re-sync is not a re-unlock.
            //
            // `??` is wrong here: an item from the very first sync has a NULL date on purpose (we
            // can't know when they got it), and `before?.firstSeenAt ?? now` would redate exactly
            // those on the next sync — putting years-old items at the top of a "recent unlocks"
            // feed. Only a genuinely new row on a page we already held is datable.
            firstSeenAt: previous.has(r.itemId)
              ? (before?.firstSeenAt ?? null)
              : (previous.size > 0 ? nowIso : null),
            kcAtUnlock: before?.kcAtUnlock ?? null,
          };
        }),
      );
      itemsWritten += rows.length;
    }

    // Counter lines ("Abyssal Sire kills: 1,204"), replaced wholesale for the same reason.
    const counts = raw?.counts;
    await db
      .delete(memberClogKc)
      .where(and(eq(memberClogKc.clanMemberId, member.clanMemberId), eq(memberClogKc.pageName, name)));
    if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
      const countRows = Object.entries(counts as Record<string, unknown>)
        .map(([label, value]) => ({ label: label.trim().slice(0, 80), count: int(value, MAX_COUNT) }))
        .filter((r): r is { label: string; count: number } => !!r.label && r.count != null)
        .slice(0, 12)
        .map((r) => ({ clanMemberId: member.clanMemberId, pageName: name, label: r.label, count: r.count }));
      if (countRows.length > 0) await db.insert(memberClogKc).values(countRows);
    }

    pagesWritten++;
  }

  if (pagesWritten === 0) {
    return NextResponse.json({ ok: true, pages: 0, skipped: skippedPages });
  }

  // Header totals are recomputed from what we hold rather than trusted from the push: the client
  // knows about the pages it has opened, we know about every page it has ever sent us.
  const [held] = await db
    .select({
      pages: sql<number>`count(distinct ${memberClogItems.pageName})`,
      obtained: sql<number>`count(*)`,
    })
    .from(memberClogItems)
    .where(eq(memberClogItems.clanMemberId, member.clanMemberId));

  // Pages we hold ITEMS for. A page where the player has nothing obtained leaves no rows, so this
  // alone would under-report progress for anyone opening pages they've never had a drop on.
  const pagesWithItems = Number(held?.pages ?? 0);
  // The client knows how many distinct pages it has actually read, which is the honest numerator.
  // Taken as a floor of our own count and clamped to the catalogue so a bad client can't claim 900.
  const claimed = int(body?.syncedPages, index.size) ?? 0;
  const syncedPages = Math.min(index.size, Math.max(pagesWithItems, claimed));
  const totalForSynced = await pagesTotalFor(member.clanMemberId, index);

  const header = {
    pagesSynced: syncedPages,
    pagesTotal: index.size,
    obtained: Number(held?.obtained ?? 0),
    total: totalForSynced,
    accountHash,
    syncedAt: nowIso,
    pluginVersion,
  };
  await db
    .insert(memberClog)
    .values({ clanMemberId: member.clanMemberId, ...header })
    .onConflictDoUpdate({ target: memberClog.clanMemberId, set: header });

  return NextResponse.json({ ok: true, pages: pagesWritten, items: itemsWritten, skipped: skippedPages, syncedPages });
}

/** Slots that EXIST on the pages this member has synced — the denominator that isn't a lie. */
async function pagesTotalFor(clanMemberId: number, index: Map<string, Set<number>>): Promise<number> {
  const rows = await db
    .selectDistinct({ pageName: memberClogItems.pageName })
    .from(memberClogItems)
    .where(eq(memberClogItems.clanMemberId, clanMemberId));
  let total = 0;
  for (const r of rows) total += index.get(r.pageName)?.size ?? 0;
  return total;
}

// A page with nothing obtained still counts as synced. It has no item rows, so the distinct-page
// count above can't see it — this is the one case the client's own tally is the better source.
export async function GET(request: Request) {
  const member = await resolvePluginMember(request);
  if (!member) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await db.query.memberClog.findFirst({
    where: eq(memberClog.clanMemberId, member.clanMemberId),
  });
  const pages = await db
    .selectDistinct({ pageName: memberClogItems.pageName })
    .from(memberClogItems)
    .where(inArray(memberClogItems.clanMemberId, [member.clanMemberId]));
  return NextResponse.json({
    syncedPages: row?.pagesSynced ?? 0,
    totalPages: row?.pagesTotal ?? clogPageIndex().size,
    obtained: row?.obtained ?? 0,
    syncedAt: row?.syncedAt ?? null,
    pages: pages.map((p) => p.pageName),
  });
}
