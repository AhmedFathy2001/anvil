import { NextResponse } from 'next/server';
import { db } from '@/db';
import { submissions, tiles, teams, players, events, users, eventStartProofs } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { verifyAdmin, verifyUser, verifyCaptain, verifyPlayer, verifyPluginToken, resolveTeamMembership } from '@/lib/auth';
import { syncDropTileCompletion, countTileProgress } from '@/lib/submissions';
import { countProgress, memberProgress } from '@/lib/countProgress';
import { parseCoopCredit } from '@/lib/coopRuns';
import { isIndividualMode } from '@/lib/statTracking';
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit';
import { notifySubmission, notifySubmissionDeleted } from '@/lib/discord';
import { queueSubmissionNotification, flushPendingNotifications } from '@/lib/notifications';
import { isManagedMediaUrl } from '@/lib/storage';
import { isDraftInProgress } from '@/lib/eventReadiness';
import { assertEventEditable } from '@/lib/eventLock';
import { parseEventRules } from '@/lib/eventRules';
import { startProofGate, NO_START_PROOF_FLAG, START_PROOF_REQUIRED_CODE } from '@/lib/startProof';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);

  const { searchParams } = new URL(request.url);
  const teamIdFilter = searchParams.get('teamId');
  const tileIdFilter = searchParams.get('tileId');
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '0', 10) || 0, 0), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  // Get all tiles for event
  const eventTiles = await db.query.tiles.findMany({
    where: eq(tiles.eventId, eId),
  });
  const tileIds = eventTiles.map((t) => t.id);

  if (tileIds.length === 0) {
    return NextResponse.json([]);
  }

  // Get submissions for this event's tiles with optional filters
  const conditions = [inArray(submissions.tileId, tileIds)];
  if (teamIdFilter) {
    conditions.push(eq(submissions.teamId, parseInt(teamIdFilter, 10)));
  }
  if (tileIdFilter) {
    conditions.push(eq(submissions.tileId, parseInt(tileIdFilter, 10)));
  }
  const filtered = limit > 0
    ? await db.select().from(submissions).where(and(...conditions))
        .orderBy(submissions.createdAt).limit(limit).offset(offset)
    : await db.select().from(submissions).where(and(...conditions))
        .orderBy(submissions.createdAt);

  // Join player names (uploader and credit)
  const allPlayers = await db.select().from(players).where(eq(players.eventId, eId));
  const playerMap = new Map(allPlayers.map((p) => [p.id, p.name]));

  const result = filtered.map((s) => ({
    ...s,
    uploaderName: s.playerId ? playerMap.get(s.playerId) || 'Unknown' : null,
    creditPlayerName: s.creditPlayerId ? playerMap.get(s.creditPlayerId) || 'Unknown' : null,
  }));

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const rl = await rateLimit(request, 'submissions', { limit: 60, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many submissions — slow down.' }, { status: 429, headers: rateLimitHeaders(rl) });
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;
  const { tileId, teamId, amount, imageUrl, note, creditPlayerId, itemId, durationSeconds, coopGroup, coopPartySize } = await request.json();

  if (!tileId || !teamId || !Number.isInteger(tileId) || !Number.isInteger(teamId) || tileId < 1 || teamId < 1) {
    return NextResponse.json({ error: 'tileId and teamId are required and must be positive integers' }, { status: 400 });
  }

  // Validate amount. The tight per-type cap is enforced after the tile is loaded — value
  // tiles carry a haul's gp value in `amount` (tens of millions), everything else a count.
  const submitAmount = amount ?? 1;
  if (!Number.isInteger(submitAmount) || submitAmount < 1 || submitAmount > 2_147_483_647) {
    return NextResponse.json({ error: 'amount must be a positive integer' }, { status: 400 });
  }

  // Validate note
  if (note !== undefined && note !== null) {
    if (typeof note !== 'string' || note.trim().length > 500) {
      return NextResponse.json({ error: 'note must be a string of at most 500 characters' }, { status: 400 });
    }
  }

  // Check auth. Legacy captain/player cookies + plugin bearer token still work; the
  // unified My Team page authenticates via the Discord web session (membership), which is
  // already scoped to this team so it can't be used to submit for another team.
  const isAdmin = await verifyAdmin();
  const captain = await verifyCaptain();
  const player = await verifyPlayer();
  const pluginAuth = await verifyPluginToken(request);
  const membership =
    !isAdmin && !captain && !player && !pluginAuth ? await resolveTeamMembership(eId, teamId) : null;

  if (!isAdmin && !captain && !player && !pluginAuth && !membership) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Non-admin must be on the correct team
  if (!isAdmin) {
    if (captain && captain.teamId !== teamId) {
      return NextResponse.json({ error: 'Cannot submit for another team' }, { status: 403 });
    }
    if (player && player.teamId !== teamId) {
      return NextResponse.json({ error: 'Cannot submit for another team' }, { status: 403 });
    }
    if (pluginAuth && pluginAuth.teamId !== teamId) {
      return NextResponse.json({ error: 'Cannot submit for another team' }, { status: 403 });
    }
  }

  // Get event and check start date
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Block submissions before event starts (admin can bypass)
  if (!isAdmin && event.startDate) {
    const now = new Date().toISOString();
    if (now < event.startDate) {
      return NextResponse.json({ error: 'Event has not started yet' }, { status: 400 });
    }
  }
  // Start safeguard belt: the lifecycle cron holds an unready event's startDate in the future, but
  // between the start moment and the next tick the date can briefly read as passed — never accept a
  // member submission while the team roster is literally mid-draft.
  if (!isAdmin && isDraftInProgress(event.draftStatus)) {
    return NextResponse.json({ error: 'The draft is still in progress — the event has not started yet.' }, { status: 400 });
  }

  // Verify tile belongs to event and is a drop tile
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Tile not found in this event' }, { status: 404 });
  }
  if (tile.tileType !== 'drop' && tile.tileType !== 'kill' && tile.tileType !== 'lap' && tile.tileType !== 'pvp' && tile.tileType !== 'gain' && tile.tileType !== 'timed' && tile.tileType !== 'deathless' && tile.tileType !== 'diary' && tile.tileType !== 'ca' && tile.tileType !== 'lms' && tile.tileType !== 'value' && tile.tileType !== 'valuetotal') {
    return NextResponse.json({ error: 'Submissions are only for drop, kill, lap, PvP, gain, timed, deathless, diary, CA, LMS, or value tiles' }, { status: 400 });
  }
  // Count-based tiles keep the old anti-typo ceiling; value tiles legitimately carry gp figures.
  if (tile.tileType !== 'value' && tile.tileType !== 'valuetotal' && submitAmount > 10000) {
    return NextResponse.json({ error: 'amount must be an integer between 1 and 10000' }, { status: 400 });
  }

  // Image/proof rules. Drops and timed clears always need a screenshot. Kill tiles auto-detected by
  // the plugin may arrive as lightweight count-only pings (no image) — the proof screenshot lands on
  // the submission that completes the tile. Count-only is gated to the plugin token, so manual web /
  // captain submissions still require proof. When present, an image must be one of our managed
  // media hosts (the configured R2/S3 base or Vercel Blob) to keep Discord embeds off phishy hosts.
  const isPluginKillPing = !!pluginAuth && (tile.tileType === 'kill' || tile.tileType === 'lap' || tile.tileType === 'pvp' || tile.tileType === 'gain' || tile.tileType === 'deathless' || tile.tileType === 'lms' || tile.tileType === 'value' || tile.tileType === 'valuetotal');
  let imageUrlValue: string | null = null;
  if (imageUrl != null && typeof imageUrl === 'string' && imageUrl.trim()) {
    let imageUrlParsed: URL;
    try {
      imageUrlParsed = new URL(imageUrl.trim());
    } catch {
      return NextResponse.json({ error: 'imageUrl must be a valid URL' }, { status: 400 });
    }
    if (!isManagedMediaUrl(imageUrlParsed.toString())) {
      return NextResponse.json(
        { error: 'imageUrl must be an uploaded proof URL — upload via /api/upload first' },
        { status: 400 },
      );
    }
    imageUrlValue = imageUrl.trim();
  } else if (!isPluginKillPing) {
    return NextResponse.json({ error: 'Image is required for submissions' }, { status: 400 });
  }

  // Shared-kill fingerprint: what the client could see of its company at kill time (lib/coopRuns
  // correlates reports of the SAME kill from it). Plugin-only — a web submitter has nothing to
  // report — and clamped hard because it's client-supplied.
  let coopGroupJson: string | null = null;
  let coopPartySizeValue: number | null = null;
  if (pluginAuth) {
    if (Array.isArray(coopGroup)) {
      const names = coopGroup
        .filter((n: unknown): n is string => typeof n === 'string')
        .map((n) => n.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter((n) => n.length > 0 && n.length <= 12)
        .slice(0, 50);
      if (names.length > 0) coopGroupJson = JSON.stringify([...new Set(names)]);
    }
    if (Number.isInteger(coopPartySize) && coopPartySize > 1 && coopPartySize <= 100) {
      coopPartySizeValue = coopPartySize;
    }
  }

  // Timed tiles carry a completion duration instead of a count. Validate it up front so the
  // value reaching the DB is always a sane positive integer (seconds, capped at 24h).
  let durationSecondsValue: number | null = null;
  if (tile.tileType === 'timed') {
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 86400) {
      return NextResponse.json(
        { error: 'durationSeconds is required for timed tiles and must be an integer between 1 and 86400' },
        { status: 400 },
      );
    }
    durationSecondsValue = durationSeconds;
  }

  // Verify team belongs to event
  const team = await db.query.teams.findFirst({
    where: and(eq(teams.id, teamId), eq(teams.eventId, eId)),
  });
  if (!team) {
    return NextResponse.json({ error: 'Team not found in this event' }, { status: 404 });
  }

  // Determine uploader playerId. Resolved BEFORE the over-submission guards below because a Solo
  // ("any one member") tile measures the SUBMITTER's own count, not the team's — so the guards need
  // to know who this submission will be credited to.
  let uploaderId: number | null = null;
  if (player) {
    uploaderId = player.playerId;
  } else if (pluginAuth) {
    uploaderId = pluginAuth.playerId;
  } else if (membership) {
    // Discord web session — attribute to the user's own player row on this team
    // (a captain-only with no player row stays unattributed, like the captain path).
    uploaderId = membership.playerId;
  } else if (captain) {
    // Captain submitting - they are the uploader
    // Find captain's player record if they have one
    const captainPlayer = await db.query.players.findFirst({
      where: and(eq(players.teamId, captain.teamId), eq(players.eventId, eId)),
    });
    uploaderId = captainPlayer?.id || null;
  }

  // Validate creditPlayerId if provided - must be on the same team
  const resolvedCreditPlayerId: number | null = creditPlayerId || null;
  if (resolvedCreditPlayerId) {
    const creditPlayer = await db.query.players.findFirst({
      where: and(eq(players.id, resolvedCreditPlayerId), eq(players.teamId, teamId)),
    });
    if (!creditPlayer) {
      return NextResponse.json({ error: 'Credit player must be on the same team' }, { status: 400 });
    }
  }
  // Who this submission counts FOR (lib/countProgress owns the same rule server-side).
  const submitterCreditId = resolvedCreditPlayerId ?? uploaderId;

  // STARTING SHOT belt (lib/startProof). On an event that requires one, a credit from a player who
  // never filed a shot is either flagged for review or refused outright, per the host's setting.
  //
  // Only drop/kill/timed-shaped credits pass through here — stat and KC tiles are swept by the
  // stats engine against a baseline taken at start, so pre-stacking is already neutralised for
  // them and there is nothing for this gate to add.
  let flaggedReason: string | null = null;
  if (!isAdmin) {
    const startProofCfg = parseEventRules(event.rules).startProof;
    if (startProofCfg && event.startProofDrawnAt) {
      const proof = submitterCreditId
        ? await db.query.eventStartProofs.findFirst({
            where: and(eq(eventStartProofs.eventId, eId), eq(eventStartProofs.playerId, submitterCreditId)),
          })
        : null;
      const gate = startProofGate(startProofCfg, event, proof);
      if (gate === 'reject') {
        return NextResponse.json(
          {
            error: 'Upload your starting shot first — open the Anvil site (My Team) and follow the starting-shot card.',
            code: START_PROOF_REQUIRED_CODE,
          },
          { status: 409 },
        );
      }
      if (gate === 'flag') flaggedReason = NO_START_PROOF_FLAG;
    }
  }

  // Per-item tracking validation
  const tileItemRequirements = tile.itemRequirements ? JSON.parse(tile.itemRequirements) as { itemId: number; name: string; requiredAmount: number }[] : null;

  if (tileItemRequirements) {
    // Per-item mode: require itemId
    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required for per-item tracked tiles' }, { status: 400 });
    }
    const requirement = tileItemRequirements.find((r: { itemId: number }) => r.itemId === itemId);
    if (!requirement) {
      return NextResponse.json({ error: 'itemId is not tracked by this tile' }, { status: 400 });
    }
    // Check per-item over-submission
    const itemSubmissions = await db
      .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId), eq(submissions.itemId, itemId)));
    const itemTotal = Number(itemSubmissions[0]?.total ?? 0);
    const submitAmount = amount || 1;

    if (itemTotal >= requirement.requiredAmount) {
      return NextResponse.json({ error: `${requirement.name} already at required amount (${requirement.requiredAmount})` }, { status: 400 });
    }
    if (itemTotal + submitAmount > requirement.requiredAmount && !isAdmin) {
      const remaining = requirement.requiredAmount - itemTotal;
      return NextResponse.json({ error: `Can only submit ${remaining} more ${requirement.name}` }, { status: 400 });
    }
  } else if (tile.tileType === 'value' && tile.requiredAmount) {
    // Value tiles: each submission is an independent haul, not a cumulative count — a 90m
    // haul on a 5m tile is the whole point. Only refuse once a qualifying haul completed it.
    const bestHaul = await db
      .select({ best: sql<number | null>`MAX(${submissions.amount})` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    if ((bestHaul[0]?.best ?? 0) >= tile.requiredAmount) {
      return NextResponse.json({ error: 'Tile already complete' }, { status: 400 });
    }
  } else if (tile.tileType === 'valuetotal' && tile.requiredAmount) {
    // Aggregate loot value: hauls sum toward the target, and the final haul may overshoot
    // (a 10m key can finish a "collect 20m" tile from 15m) — so no remainder cap here.
    const collected = await db
      .select({ total: sql<number>`COALESCE(SUM(${submissions.amount}), 0)` })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    if (Number(collected[0]?.total ?? 0) >= tile.requiredAmount) {
      return NextResponse.json({ error: 'Tile already complete' }, { status: 400 });
    }
  } else if (tile.requiredAmount) {
    // Count tiles. Team Total caps against the team's summed progress; Solo caps against the
    // SUBMITTER's own — otherwise the first member to reach the count would lock everyone else out
    // of a tile that each of them is supposed to be racing independently.
    const tileSubs = await db
      .select({
        playerId: submissions.playerId,
        creditPlayerId: submissions.creditPlayerId,
        amount: submissions.amount,
      })
      .from(submissions)
      .where(and(eq(submissions.tileId, tileId), eq(submissions.teamId, teamId)));
    const soloTile = isIndividualMode(tile.trackingMode);
    const coopTile = parseCoopCredit(tile.coopCredit) === 'per-kill' || (tile.coopMinMembers ?? 0) > 0;
    const currentTotal = coopTile
      // Shared-kill tiles count RUNS, not submissions: a teammate reporting the same kill adds
      // nothing to the total, so guarding on the raw sum would refuse the report that proves it
      // was shared. Guard on the credited figure (lib/coopRuns) and let the run absorb it.
      ? (await countTileProgress(tileId, teamId, tile.trackingMode, tile)).current
      : soloTile
        ? memberProgress(tileSubs, submitterCreditId)
        : countProgress(tileSubs, tile.trackingMode).current;
    const submitAmount = amount || 1;

    if (currentTotal >= tile.requiredAmount) {
      return NextResponse.json(
        { error: soloTile ? 'You have already reached this tile’s count' : 'Tile already complete' },
        { status: 400 },
      );
    }
    // The remainder cap doesn't apply to a shared-kill tile: a second teammate reporting the same
    // kill doesn't overshoot anything (their report merges into the run), and refusing it would
    // throw away the very evidence that the kill was shared.
    if (!coopTile && currentTotal + submitAmount > tile.requiredAmount && !isAdmin) {
      const remaining = tile.requiredAmount - currentTotal;
      return NextResponse.json({ error: `Can only submit ${remaining} more (tile needs ${tile.requiredAmount}, has ${currentTotal})` }, { status: 400 });
    }
  }

  const [submission] = await db
    .insert(submissions)
    .values({
      tileId,
      teamId,
      playerId: uploaderId,
      creditPlayerId: resolvedCreditPlayerId,
      amount: amount || 1,
      imageUrl: imageUrlValue,
      note: note || null,
      itemId: itemId || null,
      durationSeconds: durationSecondsValue,
      coopGroup: coopGroupJson,
      coopPartySize: coopPartySizeValue,
      flaggedReason,
    })
    .returning();

  // Current progress for the Discord "x / y" line — mode-aware, so a Solo tile's post reads the
  // finisher's own count rather than a team sum that isn't what completes the tile.
  const currentTotal = (await countTileProgress(tileId, teamId, tile.trackingMode, tile)).current;

  // Get credit player name if provided
  let creditPlayerName: string | null = null;
  if (resolvedCreditPlayerId) {
    const creditPlayer = await db.query.players.findFirst({
      where: eq(players.id, resolvedCreditPlayerId),
    });
    creditPlayerName = creditPlayer?.name || null;
  }

  // Resolve completion BEFORE notifying (and awaited, not in a fire-after-response setTimeout that a
  // serverless function can freeze before running) so the completion is reliably persisted and we can
  // fold "tile completed" into the single submission post — one bingo-webhook request, not two. The
  // separate completion announcement is suppressed; the team-win post still fires from inside sync.
  const syncResult = await syncDropTileCompletion(tileId, teamId, { notifyCompletion: false });

  if (tile.tileType === 'timed') {
    // Timed clears are discrete, rare, and carry a clear-time the merged embed can't express — post
    // them immediately, unchanged.
    notifySubmission({
      eventName: event?.name || 'Unknown Event',
      tileLabel: tile.label,
      teamName: team.name,
      teamColor: team.color,
      creditPlayerName,
      amount: amount || 1,
      currentTotal,
      requiredAmount: tile.requiredAmount,
      note: note || null,
      imageUrl: imageUrlValue,
      tileType: tile.tileType,
      durationSeconds: durationSecondsValue,
      completed: syncResult?.isComplete ?? false,
      eventId: eId,
      tile,
    }).catch(() => {}); // Silently ignore errors
  } else {
    // Drop/kill: debounce. Buffer into the (tile,team) bucket — a completing submission flushes its
    // own bucket inside queueSubmissionNotification; the opportunistic flush posts any *other* buckets
    // that have gone quiet. Both fire-and-forget so the response isn't held on Discord.
    await queueSubmissionNotification({
      eventId: eId,
      tileId,
      teamId,
      amount: amount || 1,
      currentTotal,
      requiredAmount: tile.requiredAmount,
      imageUrl: imageUrlValue,
      note: note || null,
      creditPlayerName,
      completed: syncResult?.isComplete ?? false,
    });
    flushPendingNotifications().catch(() => {});
  }

  return NextResponse.json({ submission }, { status: 201 });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  const eId = parseInt(eventId, 10);
  // Finished events are read-only unless explicitly unlocked (lib/eventLock).
  const lockedResponse = await assertEventEditable(eId);
  if (lockedResponse) return lockedResponse;

  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get('submissionId');
  const reason = searchParams.get('reason') || 'No reason provided';

  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId query parameter required' }, { status: 400 });
  }

  const sId = parseInt(submissionId, 10);

  // Check auth — admin / legacy captain+player cookies / Discord web session. The web
  // session is resolved against the submission's own team below. Keep the acting user's identity
  // (not just an isAdmin boolean) so the deletion audit names the real admin, not "Admin (admin)".
  const actingUser = await verifyUser();
  const isAdmin = actingUser?.role === 'admin';
  const captain = await verifyCaptain();
  const player = await verifyPlayer();

  // Get the submission with player info
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, sId),
  });
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const membership =
    !isAdmin && !captain && !player ? await resolveTeamMembership(eId, submission.teamId) : null;
  if (!isAdmin && !captain && !player && !membership) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify tile belongs to this event
  const tile = await db.query.tiles.findFirst({
    where: and(eq(tiles.id, submission.tileId), eq(tiles.eventId, eId)),
  });
  if (!tile) {
    return NextResponse.json({ error: 'Submission not in this event' }, { status: 404 });
  }

  // Get team info for Discord notification
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, submission.teamId),
  });

  // Get event info for Discord notification
  const event = await db.query.events.findFirst({
    where: eq(events.id, eId),
  });

  // Get credit player name if exists
  let creditPlayerName: string | null = null;
  if (submission.creditPlayerId) {
    const creditPlayer = await db.query.players.findFirst({
      where: eq(players.id, submission.creditPlayerId),
    });
    creditPlayerName = creditPlayer?.name || null;
  }

  // Determine who is deleting — name the real person so the audit isn't a generic "Admin (admin)".
  let deletedByName = 'Admin';
  let deletedByRole = 'admin';
  if (isAdmin) {
    if (actingUser) {
      const u = await db.query.users.findFirst({ where: eq(users.id, actingUser.userId) });
      deletedByName = u?.displayName || u?.discordUsername || actingUser.username || 'Admin';
      deletedByRole = actingUser.role || 'admin';
    }
  } else {
    if (captain) {
      deletedByName = team?.name ? `${team.name} Captain` : 'Captain';
      deletedByRole = 'captain';
    }
    if (player) {
      const playerRecord = await db.query.players.findFirst({
        where: eq(players.id, player.playerId),
      });
      deletedByName = playerRecord?.name || 'Player';
      deletedByRole = 'player';
    }
    if (membership) {
      if (membership.isCaptain) {
        deletedByName = team?.name ? `${team.name} Captain` : 'Captain';
        deletedByRole = 'captain';
      } else if (membership.playerId) {
        const playerRecord = await db.query.players.findFirst({ where: eq(players.id, membership.playerId) });
        deletedByName = playerRecord?.name || 'Player';
        deletedByRole = 'player';
      }
    }
  }

  // Auth checks: admin can delete any, captain their team, player their own.
  // Captaincy and player-ownership come from either the legacy cookies or the web session.
  if (!isAdmin) {
    const captainOfTeam = (captain && captain.teamId === submission.teamId) || (membership?.isCaptain ?? false);
    if (captainOfTeam) {
      // Allowed — captain can delete any of their team's submissions.
    } else {
      const myPlayerId =
        membership?.playerId ?? (player && player.teamId === submission.teamId ? player.playerId : null);
      if (myPlayerId == null || myPlayerId !== submission.playerId) {
        return NextResponse.json({ error: 'Can only delete your own submissions' }, { status: 403 });
      }
    }
  }

  await db.delete(submissions).where(eq(submissions.id, sId));

  // Sync completion
  const syncResult = await syncDropTileCompletion(submission.tileId, submission.teamId);

  // Send Discord notification for deletion
  if (team && event) {
    notifySubmissionDeleted({
      eventName: event.name,
      tileLabel: tile.label,
      teamName: team.name,
      teamColor: team.color,
      creditPlayerName,
      amount: submission.amount,
      deletedBy: deletedByName,
      deletedByRole,
      reason,
      eventId: event.id,
      tile,
    }).catch(() => {}); // Silently ignore errors
  }

  return NextResponse.json({ success: true, sync: syncResult });
}
