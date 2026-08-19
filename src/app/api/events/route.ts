import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { requireClan } from '@/lib/clanContext';
import { events, tiles } from '@/db/schema';
import { verifyAdmin } from '@/lib/auth';
import { validateEventRules } from '@/lib/eventRules';

export async function GET() {
  const clan = await requireClan();
  const allEvents = await db
    .select()
    .from(events)
    .where(eq(events.clanId, clan.id))
    .orderBy(desc(events.createdAt));
  return NextResponse.json(allEvents);
}

export async function POST(request: Request) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, boardSize, tileLabels, tileIcons, scoringMode, format, maxAccountsPerPerson, accountSlotMode, feeMode, rules, startDate, endDate } = await request.json();

  if (!name || !boardSize) {
    return NextResponse.json({ error: 'Name and boardSize are required' }, { status: 400 });
  }

  if (format !== undefined && format !== 'bingo' && format !== 'tilerace' && format !== 'ladder') {
    return NextResponse.json({ error: "format must be 'bingo', 'tilerace' or 'ladder'" }, { status: 400 });
  }
  const resolvedFormat = format === 'tilerace' ? 'tilerace' : format === 'ladder' ? 'ladder' : 'bingo';

  if (scoringMode !== undefined && scoringMode !== 'tiles' && scoringMode !== 'points') {
    return NextResponse.json({ error: "scoringMode must be 'tiles' or 'points'" }, { status: 400 });
  }
  // A tile race is always scored by furthest tile reached; a ladder is always a points-scored task
  // list. Point-weighting otherwise applies to the bingo format only, so force accordingly.
  const resolvedScoringMode =
    resolvedFormat === 'tilerace' ? 'tiles' : resolvedFormat === 'ladder' ? 'points' : scoringMode === 'points' ? 'points' : 'tiles';

  // Multi-account enrollment knobs — all optional; the defaults reproduce one-account-per-person.
  const MAX_ACCOUNTS_CAP = 10;
  let resolvedMaxAccounts = 1;
  if (maxAccountsPerPerson !== undefined) {
    if (!Number.isInteger(maxAccountsPerPerson) || maxAccountsPerPerson < 1 || maxAccountsPerPerson > MAX_ACCOUNTS_CAP) {
      return NextResponse.json({ error: `maxAccountsPerPerson must be an integer from 1 to ${MAX_ACCOUNTS_CAP}` }, { status: 400 });
    }
    resolvedMaxAccounts = maxAccountsPerPerson;
  }
  if (accountSlotMode !== undefined && accountSlotMode !== 'per-person' && accountSlotMode !== 'per-account') {
    return NextResponse.json({ error: "accountSlotMode must be 'per-person' or 'per-account'" }, { status: 400 });
  }
  if (feeMode !== undefined && feeMode !== 'per-person' && feeMode !== 'per-account') {
    return NextResponse.json({ error: "feeMode must be 'per-person' or 'per-account'" }, { status: 400 });
  }
  const resolvedAccountSlotMode = accountSlotMode === 'per-account' ? 'per-account' : 'per-person';
  const resolvedFeeMode = feeMode === 'per-account' ? 'per-account' : 'per-person';

  // Per-event game rules (reveal policy + scoring modifiers — lib/eventRules). Validated and
  // canonicalised; all-defaults stores NULL so classic events stay exactly as before. Reveal
  // policies ride on the points list shape, not the fixed N×N grid or the sequential race.
  const rulesResult = validateEventRules(rules);
  if ('error' in rulesResult) {
    return NextResponse.json({ error: rulesResult.error }, { status: 400 });
  }
  const resolvedRules = rulesResult.rules;
  if (resolvedRules && JSON.parse(resolvedRules).revealPolicy !== 'all') {
    // Reveal policies (incl. the ladder's rotation) ride the points-scored task-list shape — the
    // points bingo board or the ladder. Not the fixed N×N grid or the sequential race.
    const allowsReveal = (resolvedFormat === 'bingo' && resolvedScoringMode === 'points') || resolvedFormat === 'ladder';
    if (!allowsReveal) {
      return NextResponse.json(
        { error: 'Reveal policies require the points-scored bingo or ladder format.' },
        { status: 400 },
      );
    }
  }

  if (!Number.isInteger(boardSize) || boardSize < 1) {
    return NextResponse.json({ error: 'boardSize must be a positive integer' }, { status: 400 });
  }

  // A schedule at creation time. Optional — an event with no dates is a legitimate draft, and the
  // one that stays undated is exactly what the events list calls out as still being set up. Both
  // are ISO UTC strings, like every other date column.
  const parseWhen = (value: unknown, field: string): string | null | { error: string } => {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
      return { error: `${field} must be a date` };
    }
    return new Date(value).toISOString();
  };
  const resolvedStart = parseWhen(startDate, 'startDate');
  if (resolvedStart && typeof resolvedStart === 'object') {
    return NextResponse.json({ error: resolvedStart.error }, { status: 400 });
  }
  const resolvedEnd = parseWhen(endDate, 'endDate');
  if (resolvedEnd && typeof resolvedEnd === 'object') {
    return NextResponse.json({ error: resolvedEnd.error }, { status: 400 });
  }
  if (resolvedStart && resolvedEnd && Date.parse(resolvedEnd) <= Date.parse(resolvedStart)) {
    return NextResponse.json({ error: 'The end has to come after the start.' }, { status: 400 });
  }

  // Three event shapes, all keyed off (format, scoringMode):
  //   • Classic bingo  (bingo + tiles)  → a square N×N grid, so boardSize is N and tiles = N².
  //   • Leagues bingo  (bingo + points) → an arbitrary-length task list, boardSize IS the tile count.
  //   • Tile race      (tilerace)       → a linear track, boardSize IS the tile count.
  // Only classic squares boardSize; the other two use it directly as the number of tiles.
  const isClassicGrid = resolvedFormat === 'bingo' && resolvedScoringMode === 'tiles';
  if (isClassicGrid && boardSize > 12) {
    return NextResponse.json({ error: 'A classic grid is capped at 12×12.' }, { status: 400 });
  }
  if (!isClassicGrid && boardSize > 1000) {
    return NextResponse.json({ error: 'Events are capped at 1000 tiles.' }, { status: 400 });
  }
  const expectedTiles = isClassicGrid ? boardSize * boardSize : boardSize;
  // tileLabels is optional — when omitted (the "blank create" path) we generate
  // placeholder labels and the user fills tiles in via the per-tile editor / CSV import.
  let resolvedLabels: string[];
  if (Array.isArray(tileLabels) && tileLabels.length > 0) {
    if (tileLabels.length !== expectedTiles) {
      const shape = isClassicGrid
        ? `${boardSize}×${boardSize} grid`
        : resolvedFormat === 'tilerace'
          ? `${boardSize}-tile race`
          : `${boardSize}-tile Leagues board`;
      return NextResponse.json(
        { error: `Expected ${expectedTiles} tiles for a ${shape}, got ${tileLabels.length}` },
        { status: 400 },
      );
    }
    resolvedLabels = tileLabels;
  } else {
    resolvedLabels = Array.from({ length: expectedTiles }, (_, i) => `Tile ${i + 1}`);
  }

  const icons: (string | null)[] = Array.isArray(tileIcons) ? tileIcons : [];

  // Wrap the event + tiles inserts in a transaction so a partial failure can't
  // leave an event row with zero tiles (which then can't be edited from the
  // detail page because there's nothing to render). A previous schema drift on
  // the `tiles.accepted_sources` column produced exactly that orphan state for
  // event #8 — recoverable only via a manual backfill.
  const clan = await requireClan();
  const event = await db.transaction(async (tx) => {
    const [created] = await tx.insert(events).values({
      clanId: clan.id,
      name, boardSize, scoringMode: resolvedScoringMode, format: resolvedFormat,
      maxAccountsPerPerson: resolvedMaxAccounts, accountSlotMode: resolvedAccountSlotMode, feeMode: resolvedFeeMode,
      rules: resolvedRules,
      startDate: resolvedStart as string | null,
      endDate: resolvedEnd as string | null,
    }).returning();
    const tileValues = resolvedLabels.map((label: string, index: number) => ({
      eventId: created.id,
      position: index,
      label,
      icon: icons[index] || null,
    }));
    await tx.insert(tiles).values(tileValues);
    return created;
  });

  return NextResponse.json(event, { status: 201 });
}
