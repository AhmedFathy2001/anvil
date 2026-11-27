// Prints the loadout engine's answer (lib/loadout) for each seeded boss profile, with a synthetic
// endgame bank and a mid bank: worn gear, switches, inventory, phases, and each pick's reason.
//
// Run: npx tsx scripts/loadout-demo.ts [preset]   (preset: learner | experienced | max; default max)

import { buildLoadout, phaseLines } from '../src/lib/loadout/engine';
import { PROFILES } from '../src/lib/loadout/profiles';
import { PRESETS, type Preset } from '../src/lib/loadout/types';
import { idx, maxPlayer, midPlayer } from '../tests/fixtures/loadoutBanks';
import { SLOTS } from '../src/lib/dps/tables';

const preset = (PRESETS as readonly string[]).includes(process.argv[2] ?? '') ? (process.argv[2] as Preset) : 'max';
const name = (id: number | null | undefined) => idx.item(id)?.n ?? '?';

for (const profile of Object.values(PROFILES)) {
  for (const [bank, player] of [['endgame bank', maxPlayer()], ['mid bank', midPlayer()]] as const) {
    const l = buildLoadout({ profile, preset, player, idx });
    console.log(`\n══ ${profile.name} · ${bank} · ${preset} ══`);
    console.log(`Worn (${l.wornStyle}): ${SLOTS.filter((s) => l.worn[s] != null).map((s) => `${s}=${name(l.worn[s])}`).join(', ')}`);
    if (l.quiverAmmo) console.log(`Quiver: ${name(l.quiverAmmo)}`);
    console.log(`Switches: ${l.switches.map((s) => `${s.name} [${s.kit}]`).join(', ') || 'none'}`);
    console.log(`Specs: ${l.specs.map((s) => s.name).join(', ') || 'none'}`);
    console.log(`Spellbook: ${l.spellbook}${l.runePouch ? ` · pouch: ${l.runePouch.map((r) => `${r.rune}×${r.perCast}`).join(', ')}` : ''}`);
    const counts = new Map<string, number>();
    for (const s of l.inventory) counts.set(s?.name ?? '(empty)', (counts.get(s?.name ?? '(empty)') ?? 0) + 1);
    console.log(`Inventory: ${[...counts].map(([n, c]) => (c > 1 ? `${c}× ${n}` : n)).join(', ')}`);
    console.log(`Expected: ${l.expectedTime.toFixed(1)}s${l.killsPerTrip ? ` · ~${l.killsPerTrip} kills a trip` : ''}`);
    for (const p of phaseLines(l)) console.log(`  · ${p}`);
    console.log('Why:');
    for (const w of l.why) console.log(`  - ${w.pick}: ${w.why}`);
    if (l.requirementsUnmet.length) console.log(`UNMET: ${l.requirementsUnmet.map((u) => `[${u.code}] ${u.message}`).join(' | ')}`);
    if (l.warnings.length) console.log(`Warnings: ${l.warnings.join(' | ')}`);
  }
}
