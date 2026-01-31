import { NextResponse } from 'next/server';
import { db } from '@/db';
import { players, tiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyAdmin } from '@/lib/auth';

interface WomParticipation {
  player: { displayName: string };
  progress: { start: number };
}

interface WomCompetition {
  metric: string;
  startsAt: string;
  participations: WomParticipation[];
}

async function fetchCompetition(id: number): Promise<WomCompetition | null> {
  try {
    const res = await fetch(`https://api.wiseoldman.net/v2/competitions/${id}`, {
      headers: { 'User-Agent': 'OSRS-Bingo-Tracker' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  // Get all tiles with WOM competition IDs
  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });

  const tilesWithWom = eventTiles.filter(t => t.womCompetitionId);

  if (tilesWithWom.length === 0) {
    return NextResponse.json({ error: 'No tiles have WOM competition IDs' }, { status: 400 });
  }

  // Build map of skill/boss -> start values from each competition
  const playerBaselines: Record<string, Record<string, number>> = {};
  let competitionStartTime: string | null = null;
  const fetchedCompetitions: string[] = [];

  for (const tile of tilesWithWom) {
    const compId = tile.womCompetitionId!;
    const data = await fetchCompetition(compId);

    if (!data) {
      continue;
    }

    fetchedCompetitions.push(`${data.metric} (${compId})`);

    // Use the first competition's start time as the baseline timestamp
    if (!competitionStartTime && data.startsAt) {
      competitionStartTime = data.startsAt;
    }

    const metric = data.metric; // e.g., 'runecrafting', 'zulrah', etc.

    for (const p of data.participations || []) {
      const name = p.player.displayName.toLowerCase();
      if (playerBaselines[name] === undefined) {
        playerBaselines[name] = {};
      }
      playerBaselines[name][metric] = p.progress.start;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }

  // Get all players for this event
  const eventPlayers = await db.query.players.findMany({
    where: eq(players.eventId, eId),
  });

  let updated = 0;
  let skipped = 0;
  const notFound: string[] = [];

  for (const player of eventPlayers) {
    const womData = playerBaselines[player.name.toLowerCase()];
    if (womData === undefined) {
      notFound.push(player.name);
      skipped++;
      continue;
    }

    // Parse existing snapshot or create new one
    let snapshot: {
      skills: Record<string, { rank: number; level: number; xp: number }>;
      bosses: Record<string, { rank: number; score: number }>;
    } = { skills: {}, bosses: {} };

    if (player.statsSnapshot) {
      try {
        snapshot = JSON.parse(player.statsSnapshot);
        if (!snapshot.skills) snapshot.skills = {};
        if (!snapshot.bosses) snapshot.bosses = {};
      } catch {
        // ignore
      }
    }

    // Update baselines from WOM
    for (const [metric, startValue] of Object.entries(womData)) {
      // Determine if this is a skill or boss based on the metric name
      // Skills: attack, defence, strength, hitpoints, ranged, prayer, magic, cooking,
      // woodcutting, fletching, fishing, firemaking, crafting, smithing, mining,
      // herblore, agility, thieving, slayer, farming, runecrafting, hunter, construction, sailing
      const skillNames = [
        'attack', 'defence', 'strength', 'hitpoints', 'ranged', 'prayer', 'magic',
        'cooking', 'woodcutting', 'fletching', 'fishing', 'firemaking', 'crafting',
        'smithing', 'mining', 'herblore', 'agility', 'thieving', 'slayer', 'farming',
        'runecrafting', 'hunter', 'construction', 'sailing', 'overall'
      ];

      if (skillNames.includes(metric)) {
        if (snapshot.skills[metric] === undefined) {
          snapshot.skills[metric] = { rank: -1, level: 1, xp: 0 };
        }
        snapshot.skills[metric].xp = startValue;
      } else {
        // It's a boss
        if (snapshot.bosses[metric] === undefined) {
          snapshot.bosses[metric] = { rank: -1, score: 0 };
        }
        snapshot.bosses[metric].score = startValue;
      }
    }

    // Update the player's baseline
    await db.update(players).set({
      statsSnapshot: JSON.stringify(snapshot),
      snapshotAt: competitionStartTime || new Date().toISOString(),
    }).where(eq(players.id, player.id));

    updated++;
  }

  return NextResponse.json({
    updated,
    skipped,
    notFound,
    competitions: fetchedCompetitions,
  });
}
