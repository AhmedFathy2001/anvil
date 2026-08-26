import { NextResponse } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { memberClog, memberClogItems, memberClogKc } from '@/db/schema';
import { resolvePluginMember } from '@/lib/auth';
import { rateLimitByKey, rateLimitHeaders } from '@/lib/rate-limit';
import { clogPageIndex, clogTotalSlots, groupObtainedItems } from '@/lib/clogDataset';
import { bossKeyForPage, bossKillsFor } from '@/lib/clogLuckBoard';

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
/** A whole-log push carries every obtained item at once — the catalogue is ~1,700 slots today. */
const MAX_ITEMS_PER_LOG = 5_000;
/** Rows per insert. SQLite caps bound parameters per statement; a full log needs several passes. */
const INSERT_CHUNK = 200;

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

  let body: { pages?: unknown; items?: unknown; syncedPages?: unknown; counts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // WHOLE-LOG push. The plugin can have the server transmit every entry at once instead of the
  // player paging through the log, and what arrives is a flat obtained-item list with no pages.
  // It's authoritative by construction — everything they own, in one shot — so it replaces the
  // stored log rather than merging into it.
  if (Array.isArray(body?.items)) {
    // A whole-log push rewrites ~1,700 rows. Once a minute per member is generous for a thing whose
    // input only changes when a drop lands, and it means a client stuck in a retry loop — or a
    // player mashing the sync button — costs one write, not one per attempt. 429 is deliberately
    // retryable: the plugin backs off rather than dropping the log it just collected.
    const rl = await rateLimitByKey('clog-full', String(member.accountId), { limit: 1, windowMs: 60_000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Your collection log was synced less than a minute ago.', retryAfterMs: rl.reset - Date.now() },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
    return ingestWholeLog(body.items as IncomingItem[], member, {
      // Kill counters, when the client sends them. The whole-log transmit hands us every obtained
      // item but historically no counts, which left the unlock stamp guessing — see ingestWholeLog.
      counts: body.counts && typeof body.counts === 'object' && !Array.isArray(body.counts)
        ? (body.counts as Record<string, unknown>)
        : null,
      nowIso: new Date().toISOString(),
      pluginVersion: request.headers.get('X-Anvil-Plugin-Version')?.slice(0, 32) ?? null,
      accountHash: request.headers.get('X-Account-Hash')?.slice(0, 128) ?? null,
    });
  }

  if (!Array.isArray(body?.pages) || body.pages.length === 0) {
    return NextResponse.json({ error: 'pages[] or items[] required' }, { status: 400 });
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
      .where(and(eq(memberClogItems.accountId, member.accountId), eq(memberClogItems.pageName, name)));
    const previous = new Map(existing.map((r) => [r.itemId, r]));

    await db
      .delete(memberClogItems)
      .where(and(eq(memberClogItems.accountId, member.accountId), eq(memberClogItems.pageName, name)));

    if (rows.length > 0) {
      await db.insert(memberClogItems).values(
        rows.map((r) => {
          const before = previous.get(r.itemId);
          return {
            accountId: member.accountId,
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
      )
        // The unique index is (member, item), not (member, page, item): the same item filed under a
        // different page — Jagex moved it, or two synced pages both list it — would otherwise fail
        // the whole statement and lose the page.
        .onConflictDoUpdate({
          target: [memberClogItems.accountId, memberClogItems.itemId],
          set: { pageName: sql`excluded.page_name`, quantity: sql`excluded.quantity` },
        });
      itemsWritten += rows.length;
    }

    // Counter lines ("Abyssal Sire kills: 1,204"), replaced wholesale for the same reason.
    const counts = raw?.counts;
    await db
      .delete(memberClogKc)
      .where(and(eq(memberClogKc.accountId, member.accountId), eq(memberClogKc.pageName, name)));
    if (counts && typeof counts === 'object' && !Array.isArray(counts)) {
      const countRows = Object.entries(counts as Record<string, unknown>)
        .map(([label, value]) => ({ label: label.trim().slice(0, 80), count: int(value, MAX_COUNT) }))
        .filter((r): r is { label: string; count: number } => !!r.label && r.count != null)
        .slice(0, 12)
        .map((r) => ({ accountId: member.accountId, pageName: name, label: r.label, count: r.count }));
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
    .where(eq(memberClogItems.accountId, member.accountId));

  // Pages we hold ITEMS for. A page where the player has nothing obtained leaves no rows, so this
  // alone would under-report progress for anyone opening pages they've never had a drop on.
  const pagesWithItems = Number(held?.pages ?? 0);
  // The client knows how many distinct pages it has actually read, which is the honest numerator.
  // Taken as a floor of our own count and clamped to the catalogue so a bad client can't claim 900.
  const claimed = int(body?.syncedPages, index.size) ?? 0;
  const syncedPages = Math.min(index.size, Math.max(pagesWithItems, claimed));
  const totalForSynced = await pagesTotalFor(member.accountId, index);

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
    .values({ accountId: member.accountId, ...header })
    .onConflictDoUpdate({ target: memberClog.accountId, set: header });

  return NextResponse.json({ ok: true, pages: pagesWritten, items: itemsWritten, skipped: skippedPages, syncedPages });
}

/**
 * A page's own kill counter, keyed by lowercased page name.
 *
 * The collection log prints the count on the page itself ("Chambers of Xeric kills: 80"), which is
 * the game's number and therefore the right one to stamp an unlock with. Two sources, best first:
 *
 *   1. `sent` — counters riding along with THIS push, so they're as fresh as the log the client just
 *      read. A client that doesn't send them simply contributes nothing here.
 *   2. member_clog_kc — what a previous per-page sync stored. Older, but still the game's number
 *      rather than an inference from hiscores.
 *
 * A page can carry several counters (normal and Challenge Mode clears); the largest is the one an
 * unlock is measured against, since that's the total attempts at the page.
 */
async function pageKillCounts(
  accountId: number,
  sent: Record<string, unknown> | null | undefined,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();

  const stored = await db
    .select({ pageName: memberClogKc.pageName, count: memberClogKc.count })
    .from(memberClogKc)
    .where(eq(memberClogKc.accountId, accountId));
  for (const row of stored) {
    const key = row.pageName.toLowerCase();
    out.set(key, Math.max(out.get(key) ?? 0, row.count));
  }

  // Sent counters override rather than max-merge with the stored ones: this push read the log just
  // now, so where the two disagree the older number is simply out of date.
  for (const [page, labels] of Object.entries(sent ?? {})) {
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) continue;
    let best: number | null = null;
    for (const value of Object.values(labels as Record<string, unknown>)) {
      const n = int(value, MAX_COUNT);
      if (n != null && (best == null || n > best)) best = n;
    }
    if (best != null) out.set(page.trim().toLowerCase(), best);
  }

  return out;
}

/**
 * Store a WHOLE-LOG push: the complete set of obtained items, mapped onto our own page catalogue.
 *
 * Unlike the page path this is a full replace — every page is rewritten, including to empty, because
 * the payload can answer for the whole log and a leftover row would be a claim we can no longer
 * support. Kill-count lines are never WIPED here — a push without them can't answer for them, and
 * clearing them because a different sync route ran would lose data this one can't replace — but a
 * push that DOES carry them updates them, because that's the freshest reading of the game's own
 * counter we will ever get.
 */
async function ingestWholeLog(
  rawItems: IncomingItem[],
  // The collection log belongs to the ACCOUNT: it follows the player between clans rather than
  // starting again on each roster they join. (multi-clan) The `counts` map is beta's unlock-KC
  // feature — dating an unlock by the kill that produced it — kept intact.
  member: { accountId: number },
  meta: {
    nowIso: string;
    pluginVersion: string | null;
    accountHash: string | null;
    /** Optional "<page> <label>" -> count map; see the kill-count note below. */
    counts?: Record<string, unknown> | null;
  },
) {
  if (rawItems.length > MAX_ITEMS_PER_LOG) {
    return NextResponse.json({ error: `At most ${MAX_ITEMS_PER_LOG} items per push` }, { status: 400 });
  }
  // An empty transmit is indistinguishable from a broken one, and acting on it would delete a good
  // log. A player with genuinely nothing obtained loses nothing by us doing this.
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'items[] was empty — refusing to replace a stored log with nothing' }, { status: 400 });
  }

  const parsed: { id: number; quantity: number }[] = [];
  for (const item of rawItems) {
    const itemId = int(item?.id, 100_000_000);
    if (itemId == null) continue;
    parsed.push({ id: itemId, quantity: Math.max(1, int(item?.q, MAX_COUNT) ?? 1) });
  }

  const { pages, unknown } = groupObtainedItems(parsed);

  // Keep the unlock dates we already hold: a re-sync is not a re-unlock. Keyed per (page, item)
  // exactly as the table is.
  const existing = await db
    .select({
      pageName: memberClogItems.pageName,
      itemId: memberClogItems.itemId,
      quantity: memberClogItems.quantity,
      firstSeenAt: memberClogItems.firstSeenAt,
      kcAtUnlock: memberClogItems.kcAtUnlock,
    })
    .from(memberClogItems)
    .where(eq(memberClogItems.accountId, member.accountId));
  const previous = new Map(existing.map((r) => [`${r.pageName} ${r.itemId}`, r]));
  // Whether we held ANY log before decides how a new row is dated: on a first-ever sync we can't
  // know when anything was obtained, so it stays NULL rather than dating years-old items to today.
  const hadLog = existing.length > 0;

  // Kill counts, for stamping an unlock we are watching land. Only read when this ISN'T a first
  // sync: on a first sync everything is new and none of it happened just now.
  //
  // TWO sources, and the order matters. bossKillsFor() INFERS the count from the live-stat overlay
  // floored by the last hiscores snapshot, and both lag: the overlay only carries bosses some tile
  // tracks, and hiscores only flush on logout. That inference is what stamped an Ancestral bottom at
  // 79 KC when the drop happened on the 80th — the site's own copy was one kill behind while the
  // game had already said 80.
  //
  // The log's OWN counter is the game's number, read off the page the item is on, so it wins where
  // the client sends it. Falling back to the stored counter (member_clog_kc, written by the per-page
  // sync) still beats inferring, because it too came from the game.
  const kills = hadLog
    ? await bossKillsFor(member.accountId).catch(() => ({}) as Record<string, number>)
    : ({} as Record<string, number>);
  const pageCounts = hadLog ? await pageKillCounts(member.accountId, meta.counts) : new Map<string, number>();

  const rows = [...pages.entries()].flatMap(([pageName, items]) =>
    items.map((r) => {
      const before = previous.get(`${pageName} ${r.itemId}`);
      const bossKey = bossKeyForPage(pageName);
      // The one moment this is knowable: they didn't have it, now they do, so their current KC is
      // the KC it dropped at. Every later sync copies the stamp rather than re-reading it — after
      // the fact, a pet spooned at 12 and one earned at 3,000 look identical.
      const stamped = !before && hadLog
        ? (pageCounts.get(pageName.toLowerCase()) ?? (bossKey ? kills[bossKey] ?? null : null))
        : null;
      return {
        accountId: member.accountId,
        itemId: r.itemId,
        pageName,
        quantity: r.quantity,
        firstSeenAt: before ? before.firstSeenAt : hadLog ? meta.nowIso : null,
        kcAtUnlock: before?.kcAtUnlock ?? stamped,
      };
    }),
  );

  // Write only what actually changed.
  //
  // The client has to send the whole log — the transmit hands it everything at once and it can't
  // know what we already hold — but that is no reason for us to rewrite 1,700 rows because somebody
  // got one pet. A re-sync after a single drop is now one insert; an unchanged one is no writes at
  // all, which matters because opening the collection log re-sends it.
  const desired = new Map(rows.map((r) => [r.itemId, r]));
  const held = new Map(existing.map((r) => [r.itemId, r]));

  const gone = [...held.keys()].filter((id) => !desired.has(id));
  const added = rows.filter((r) => !held.has(r.itemId));
  // An item can move page between game updates, and a stackable one's count grows.
  const changed = rows.filter((r) => {
    const before = held.get(r.itemId);
    return before && (before.pageName !== r.pageName || before.quantity !== r.quantity);
  });

  for (let i = 0; i < gone.length; i += INSERT_CHUNK) {
    await db
      .delete(memberClogItems)
      .where(
        and(
          eq(memberClogItems.accountId, member.accountId),
          inArray(memberClogItems.itemId, gone.slice(i, i + INSERT_CHUNK)),
        ),
      );
  }
  // SQLite takes a bounded number of bound parameters per statement, so a first sync — the one case
  // that really is ~1,700 rows — still goes up in chunks. The conflict clause covers a row we didn't
  // know we held: one duplicate must not throw away the whole sync.
  for (let i = 0; i < added.length; i += INSERT_CHUNK) {
    await db
      .insert(memberClogItems)
      .values(added.slice(i, i + INSERT_CHUNK))
      .onConflictDoUpdate({
        target: [memberClogItems.accountId, memberClogItems.itemId],
        set: { pageName: sql`excluded.page_name`, quantity: sql`excluded.quantity` },
      });
  }
  for (const row of changed) {
    await db
      .update(memberClogItems)
      .set({ pageName: row.pageName, quantity: row.quantity })
      .where(
        and(eq(memberClogItems.accountId, member.accountId), eq(memberClogItems.itemId, row.itemId)),
      );
  }

  // Persist any counters this push carried. They're the freshest reading of the game's own counter
  // we'll ever get, and throwing them away would leave the next sync stamping from an inference
  // again. Per page, and only pages that were sent — a push with no counters leaves them all alone.
  if (meta.counts) {
    for (const [page, labels] of Object.entries(meta.counts)) {
      if (!labels || typeof labels !== 'object' || Array.isArray(labels)) continue;
      const pageName = page.trim().slice(0, 120);
      if (!pageName) continue;
      const countRows = Object.entries(labels as Record<string, unknown>)
        .map(([label, value]) => ({ label: label.trim().slice(0, 80), count: int(value, MAX_COUNT) }))
        .filter((r): r is { label: string; count: number } => !!r.label && r.count != null)
        .slice(0, 12)
        .map((r) => ({ accountId: member.accountId, pageName, label: r.label, count: r.count }));
      if (countRows.length === 0) continue;
      await db
        .delete(memberClogKc)
        .where(and(eq(memberClogKc.accountId, member.accountId), eq(memberClogKc.pageName, pageName)));
      await db.insert(memberClogKc).values(countRows);
    }
  }

  const index = clogPageIndex();
  const header = {
    // A whole-log transmit covers the catalogue, not just the pages someone opened.
    pagesSynced: index.size,
    pagesTotal: index.size,
    obtained: rows.length,
    total: clogTotalSlots(),
    accountHash: meta.accountHash,
    syncedAt: meta.nowIso,
    pluginVersion: meta.pluginVersion,
  };
  await db
    .insert(memberClog)
    .values({ accountId: member.accountId, ...header })
    .onConflictDoUpdate({ target: memberClog.accountId, set: header });

  return NextResponse.json({
    ok: true,
    mode: 'full',
    pages: index.size,
    items: rows.length,
    // What the push actually changed, so a client (and a person reading logs) can tell a real sync
    // from a no-op.
    added: added.length,
    removed: gone.length,
    updated: changed.length,
    // Non-zero means the game has items our catalogue doesn't: re-run `npm run data:clog`.
    unknown,
  });
}

/** Slots that EXIST on the pages this account has synced — the denominator that isn't a lie. */
async function pagesTotalFor(accountId: number, index: Map<string, Set<number>>): Promise<number> {
  const rows = await db
    .selectDistinct({ pageName: memberClogItems.pageName })
    .from(memberClogItems)
    .where(eq(memberClogItems.accountId, accountId));
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
    where: eq(memberClog.accountId, member.accountId),
  });
  const pages = await db
    .selectDistinct({ pageName: memberClogItems.pageName })
    .from(memberClogItems)
    .where(inArray(memberClogItems.accountId, [member.accountId]));
  return NextResponse.json({
    syncedPages: row?.pagesSynced ?? 0,
    totalPages: row?.pagesTotal ?? clogPageIndex().size,
    obtained: row?.obtained ?? 0,
    syncedAt: row?.syncedAt ?? null,
    pages: pages.map((p) => p.pageName),
  });
}
