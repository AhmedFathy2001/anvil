// Which piece of an item set an unlinked credit probably is.
//
// An item set tile counts each credit toward the item it names. A credit filed while the tile was
// still a plain drop pool (or by an older plugin) names none, so it counts toward nothing. Staff
// link it by hand (the submissions PATCH 'set-item'); this offers the likely answer, read off the
// chat lines the plugin kept with the screenshot ("New item added to your collection log: Guthan's helm").

const PATTERNS = [
  /collection log:\s*(.+?)\s*$/i,
  /valuable drop:\s*(?:\d+\s*x\s*)?(.+?)\s*(?:\(|$)/i,
  /untradeable drop:\s*(.+?)\s*$/i,
  /special loot:\s*(.+?)\s*$/i,
];

function fold(s: string): string {
  return s.toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').replace(/[.!]+$/, '').trim();
}

/** The item names the chat lines mention, in order. */
export function namedItems(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    for (const re of PATTERNS) {
      const m = re.exec(line);
      if (m?.[1]) {
        out.push(fold(m[1]));
        break;
      }
    }
  }
  return out;
}

/**
 * The set item the credit's chat lines name, or null. `proofFacts` is the stored proof
 * (`{ lines: [{ text }] }`); `taken` are items other credits on the same team already link, so two
 * credits from one chest aren't both offered the first piece it mentions.
 */
export function suggestSetItem(
  proofFacts: unknown,
  reqs: { itemId: number; name: string }[],
  taken: Set<number> = new Set(),
): number | null {
  let facts = proofFacts;
  if (typeof facts === 'string') {
    try {
      facts = JSON.parse(facts);
    } catch {
      return null;
    }
  }
  const lines = (facts as { lines?: { text?: unknown }[] } | null)?.lines;
  if (!Array.isArray(lines) || reqs.length === 0) return null;
  const byName = new Map(reqs.map((r) => [fold(r.name), r.itemId]));
  const hits = namedItems(lines.map((l) => (typeof l?.text === 'string' ? l.text : ''))).flatMap((n) => {
    const id = byName.get(n);
    return id == null ? [] : [id];
  });
  return hits.find((id) => !taken.has(id)) ?? hits[0] ?? null;
}
