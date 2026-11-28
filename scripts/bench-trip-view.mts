// The whole 'trip' view against a real (throwaway) database: the ToA lobby's bank-close ask for a
// player with a large bank, cold and warm, and the same ask after an items push warmed it
// (pluginUi/tripView warmTrip). Prints the view's own phase timings (TRIP_TIMING=1).
//
// Run: TESTS_OK=1 TRIP_TIMING=1 npx tsx scripts/bench-trip-view.mts [bankSize=1000]

import { useTestDatabase as testDatabase, resetDatabase, dropDatabase, loadDb } from '../tests/helpers/testDb.ts';
import { tokenHash } from '../tests/helpers/tokenHash.ts';
import itemsJson from '../src/data/gearItems.json' with { type: 'json' };
import type { GearData } from '../src/lib/dps/summary.ts';

if (process.env.TESTS_OK !== '1') throw new Error('Set TESTS_OK=1: this creates and drops a local database');
process.env.TRIP_TIMING = '1';
const DB = testDatabase('trip-view-bench');
const size = Number(process.argv[2] ?? 1000);

await resetDatabase(DB);
const { pool } = await loadDb();
const { saveSnapshot, saveTripState } = await import('../src/lib/playerItems.ts');
const { cleanTripState } = await import('../src/lib/tripState.ts');
const tv = (await import('../src/lib/pluginUi/tripView.ts')) as typeof import('../src/lib/pluginUi/tripView.ts') & { warmTrip?: (r: Request, region: number) => Promise<void> };
const { tripView } = tv;

const p = await pool.query(`INSERT INTO players (display_name) VALUES ('Bench') RETURNING id`);
const playerId = p.rows[0].id as number;
await pool.query(`INSERT INTO users (discord_id, display_name, player_id, plugin_token_hash) VALUES ('dbench', 'Bench', $1, $2)`, [playerId, tokenHash('bench-token')]);
const a = await pool.query(`INSERT INTO accounts (rsn, rsn_normalized, player_id, is_primary) VALUES ('Bench', 'bench', $1, 1) RETURNING id`, [playerId]);
const accountId = a.rows[0].id as number;

const gear = (itemsJson as unknown as GearData).items.filter((i, n) => !i.hid && n % 2 === 0).slice(0, size).map((i) => ({ id: i.id }));
const now = () => new Date().toISOString();
const bank = [...gear, ...[6685, 3024, 385, 391, 12791, 560, 565, 555].map((id) => ({ id, q: 500 }))];
await saveSnapshot(accountId, { bank: { items: bank, readAt: now() }, equipment: { items: [{ id: 4151 }, { id: 12954 }], readAt: now() }, inventory: { items: [{ id: 6685 }, { id: 385 }], readAt: now() } });
await saveTripState(accountId, cleanTripState({ book: 0, pouch: [], pray: ['rigour', 'augury'] })!);

const req = () => new Request('https://example.test/api/plugin/ui?v=trip', { headers: { Authorization: 'Bearer bench-token', 'X-RSN': 'Bench', 'X-Anvil-Bank-Filter': '1' } });
const ask = async (label: string) => {
  const t = performance.now();
  const v = (await tripView(req(), { region: '13454', why: 'bank-close' })) as { warn?: { title: string } | null };
  console.log(`${label}: ${(performance.now() - t).toFixed(0)}ms → ${v.warn?.title ?? 'no warn'}`);
};
console.log(`bank: ${bank.length} stacks`);
await ask('cold (first in this process)');
await ask('again, nothing changed');
// A bank push while banking: the items change, the push warms the check, the bank-close ask follows.
await saveSnapshot(accountId, { inventory: { items: [{ id: 6685 }, { id: 385 }, { id: 391 }], readAt: now() } });
await ask('after the inventory changed (no warm)');
await saveSnapshot(accountId, { inventory: { items: [{ id: 6685 }, { id: 391 }], readAt: now() } });
const t = performance.now();
await tv.warmTrip?.(req(), 13454);
console.log(`warm on the items push: ${(performance.now() - t).toFixed(0)}ms (in the background, after the push answered)`);
await ask('bank-close ask after the warm');

await pool.end();
await dropDatabase(DB);
