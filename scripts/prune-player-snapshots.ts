/**
 * One-time backfill/prune for player_snapshots.
 *
 * History: the weekly cron used to append a full ~5KB hiscores blob per member per 15-min
 * tick with no competition scoping and no retention, ballooning the table to ~260k rows /
 * 1.2GB. The schema is now competition-scoped — exactly two rows per (member, competition):
 * a frozen 'baseline' and an overwritten 'current'. This script reshapes the legacy rows to
 * match, KEEPING every event's baseline + final and deleting only the redundant middle ticks.
 *
 * What it keeps, per (member, competition) the member participated in:
 *   - baseline = the member's EARLIEST snapshot inside [start_date, end_date]
 *   - current  = the member's LATEST   snapshot inside [start_date, end_date]
 * Plus, for any member with snapshots but no competition-scoped 'current', one orphan
 * 'current' (NULL competition) = their most recent snapshot, so the rename detector still
 * has a latest-XP reading. Everything else is deleted.
 *
 * Safe by construction: reconstructed rows are inserted first (they get fresh ids), then every
 * pre-existing row (id <= the captured max) is deleted, all inside one transaction.
 *
 * Usage:
 *   npx tsx scripts/prune-player-snapshots.ts            # DRY RUN — reports, changes nothing
 *   npx tsx scripts/prune-player-snapshots.ts --apply    # actually reshape + delete
 *
 * After --apply on a local SQLite file, run `VACUUM;` to shrink the file on disk (a plain
 * DELETE frees pages for reuse but doesn't return them to the OS).
 */
import { createClient, type Client } from '@libsql/client';
import { readFileSync } from 'fs';

for (const envFile of ['.env', '.env.local']) {
  try {
    for (const line of readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^([^#=]+)=["']?(.+?)["']?$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2];
    }
  } catch {}
}

const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
if (!url) {
  console.error('Set TURSO_DATABASE_URL (and TURSO_AUTH_TOKEN if remote).');
  process.exit(1);
}
const apply = process.argv.includes('--apply');

interface RebuiltRow {
  clanMemberId: number;
  weeklyCompetitionId: number | null;
  kind: 'baseline' | 'current';
  payload: string;
  overallXp: number | null;
  capturedAt: string;
}

async function boundarySnapshot(
  c: Client,
  memberId: number,
  start: string,
  end: string,
  order: 'ASC' | 'DESC',
) {
  // datetime() normalizes both 'YYYY-MM-DD HH:MM:SS' and ISO 'YYYY-MM-DDTHH:MM:SSZ' so the
  // window comparison is correct regardless of which format each column was written in.
  const r = await c.execute({
    sql: `SELECT payload, overall_xp, captured_at FROM player_snapshots
          WHERE clan_member_id = ?
            AND datetime(captured_at) BETWEEN datetime(?) AND datetime(?)
          ORDER BY datetime(captured_at) ${order}, id ${order}
          LIMIT 1`,
    args: [memberId, start, end],
  });
  return r.rows[0] as { payload: string; overall_xp: number | null; captured_at: string } | undefined;
}

async function main() {
  const c = createClient({ url: url!, authToken });

  const before = Number((await c.execute('SELECT COUNT(*) n FROM player_snapshots')).rows[0].n);
  const maxIdRow = (await c.execute('SELECT MAX(id) m FROM player_snapshots')).rows[0].m;
  const maxOldId = maxIdRow == null ? 0 : Number(maxIdRow);

  const comps = (await c.execute(
    'SELECT id, title, start_date, end_date, status FROM weekly_competitions ORDER BY datetime(start_date)',
  )).rows as Array<{ id: number; title: string; start_date: string; end_date: string; status: string }>;

  // Dedupe to unique (competition, member) pairs. A member with multiple RSNs (alts) can have
  // several weekly_participants rows in the SAME competition — the unique key there is on
  // rsn_normalized, not clan_member_id — but a member gets exactly one baseline + one current per
  // competition, so processing a pair twice would violate the snapshot unique index.
  const rawParts = (await c.execute(
    'SELECT competition_id, clan_member_id FROM weekly_participants WHERE clan_member_id IS NOT NULL',
  )).rows as Array<{ competition_id: number; clan_member_id: number }>;
  const seenPairs = new Set<string>();
  const parts: Array<{ competition_id: number; clan_member_id: number }> = [];
  for (const p of rawParts) {
    const k = `${p.competition_id}:${p.clan_member_id}`;
    if (seenPairs.has(k)) continue;
    seenPairs.add(k);
    parts.push(p);
  }

  const rebuilt: RebuiltRow[] = [];
  const membersWithCurrent = new Set<number>();
  // (member, comp) pairs that produced both rows — used to verify the latest event.
  const filledPairs = new Set<string>();

  for (const p of parts) {
    const comp = comps.find((x) => x.id === p.competition_id);
    if (!comp) continue;
    const base = await boundarySnapshot(c, p.clan_member_id, comp.start_date, comp.end_date, 'ASC');
    const curr = await boundarySnapshot(c, p.clan_member_id, comp.start_date, comp.end_date, 'DESC');
    if (base) {
      rebuilt.push({ clanMemberId: p.clan_member_id, weeklyCompetitionId: comp.id, kind: 'baseline', payload: base.payload, overallXp: base.overall_xp, capturedAt: base.captured_at });
    }
    if (curr) {
      rebuilt.push({ clanMemberId: p.clan_member_id, weeklyCompetitionId: comp.id, kind: 'current', payload: curr.payload, overallXp: curr.overall_xp, capturedAt: curr.captured_at });
      membersWithCurrent.add(p.clan_member_id);
    }
    if (base && curr) filledPairs.add(`${p.clan_member_id}:${comp.id}`);
  }

  // Orphan latest-per-member for anyone with snapshots but no competition-scoped current.
  const allMembers = (await c.execute('SELECT DISTINCT clan_member_id FROM player_snapshots')).rows as Array<{ clan_member_id: number }>;
  let orphans = 0;
  for (const { clan_member_id } of allMembers) {
    if (membersWithCurrent.has(clan_member_id)) continue;
    const latest = (await c.execute({
      sql: 'SELECT payload, overall_xp, captured_at FROM player_snapshots WHERE clan_member_id = ? ORDER BY datetime(captured_at) DESC, id DESC LIMIT 1',
      args: [clan_member_id],
    })).rows[0] as { payload: string; overall_xp: number | null; captured_at: string } | undefined;
    if (latest) {
      rebuilt.push({ clanMemberId: clan_member_id, weeklyCompetitionId: null, kind: 'current', payload: latest.payload, overallXp: latest.overall_xp, capturedAt: latest.captured_at });
      orphans++;
    }
  }

  // Belt-and-suspenders: collapse any duplicate (member, competition, kind) so a stray dup can
  // never abort the transaction against the unique index. NULL competition keyed as 'null'.
  const dedupKeys = new Set<string>();
  const deduped: RebuiltRow[] = [];
  for (const r of rebuilt) {
    const k = `${r.clanMemberId}:${r.weeklyCompetitionId ?? 'null'}:${r.kind}`;
    if (dedupKeys.has(k)) continue;
    dedupKeys.add(k);
    deduped.push(r);
  }
  rebuilt.length = 0;
  rebuilt.push(...deduped);

  // Report
  const baselineCount = rebuilt.filter((r) => r.kind === 'baseline').length;
  const currentCount = rebuilt.filter((r) => r.kind === 'current').length;
  console.log(`\nplayer_snapshots reshape ${apply ? '(APPLYING)' : '(DRY RUN)'}`);
  console.log(`  before:        ${before} rows`);
  console.log(`  keep/rebuild:  ${rebuilt.length} rows  (${baselineCount} baseline + ${currentCount} current; ${orphans} orphan-latest)`);
  console.log(`  will delete:   ${before - 0} legacy rows (id <= ${maxOldId}), replaced by the ${rebuilt.length} above`);
  console.log(`  net after:     ~${rebuilt.length} rows`);

  // Verify the latest event ends up properly configured.
  const lastComp = comps[comps.length - 1];
  if (lastComp) {
    const lastParts = parts.filter((p) => p.competition_id === lastComp.id);
    const ok = lastParts.filter((p) => filledPairs.has(`${p.clan_member_id}:${lastComp.id}`)).length;
    const missing = lastParts.length - ok;
    console.log(`\n  latest event "${lastComp.title}" (id ${lastComp.id}, ${lastComp.status}):`);
    console.log(`    participants: ${lastParts.length} · baseline+current built: ${ok}` + (missing ? ` · ${missing} had no in-window snapshot (cron will create on next tick)` : ' · all configured ✓'));
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to execute.\n');
    process.exit(0);
  }

  // Apply: insert rebuilt rows (fresh ids > maxOldId), then delete every legacy row, atomically.
  const tx = await c.transaction('write');
  try {
    for (const r of rebuilt) {
      await tx.execute({
        sql: `INSERT INTO player_snapshots (clan_member_id, weekly_competition_id, kind, payload, overall_xp, captured_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [r.clanMemberId, r.weeklyCompetitionId, r.kind, r.payload, r.overallXp, r.capturedAt],
      });
    }
    await tx.execute({ sql: 'DELETE FROM player_snapshots WHERE id <= ?', args: [maxOldId] });
    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }

  const after = Number((await c.execute('SELECT COUNT(*) n FROM player_snapshots')).rows[0].n);
  console.log(`\nDone. ${before} -> ${after} rows.`);
  if (url!.startsWith('file:')) console.log('Run `VACUUM;` on the file to reclaim disk space.\n');
  else console.log('Remote DB: storage reclaims server-side; no manual VACUUM needed.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
