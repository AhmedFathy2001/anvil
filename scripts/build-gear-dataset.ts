// Regenerates the BUNDLED gear-calculator datasets (src/data/gearItems.json, gearMonsters.json) from
// the OSRS Wiki. The fetching lives in src/lib/dps/wikiDataset so /staff's refresh button runs the
// very same code.
//
// Run:  npm run data:gear

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchGearDataset } from '../src/lib/dps/wikiDataset';

const HERE = dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log('Fetching equipment and monsters via the Bucket API…');
  const { items, monsters } = await fetchGearDataset((msg) => process.stdout.write(`  ${msg}\r`));
  process.stdout.write('\n');
  const at = new Date().toISOString();
  writeFileSync(resolve(HERE, '../src/data/gearItems.json'), JSON.stringify({ source: 'https://oldschool.runescape.wiki/w/Special:Bucket/infobox_bonuses', generatedAt: at, items }) + '\n');
  writeFileSync(resolve(HERE, '../src/data/gearMonsters.json'), JSON.stringify({ source: 'https://oldschool.runescape.wiki/w/Special:Bucket/infobox_monster', generatedAt: at, monsters }) + '\n');
  console.log(`Wrote ${items.length} items and ${monsters.length} monsters.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
