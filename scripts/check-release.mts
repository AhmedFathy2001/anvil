// Reads a release file on stdin and prints it the way it will be announced, or fails with why.
// Used by scripts/promote.sh: `git show <sha>:releases/1.15.0.md | node --experimental-strip-types scripts/check-release.mts`
import { parseReleaseNote } from '../src/lib/releaseNotes.ts';

let text = '';
for await (const chunk of process.stdin) text += chunk;
try {
  const r = parseReleaseNote(text);
  const out: string[] = [`Anvil ${r.version}: ${r.title}`];
  if (r.pluginVersion) out.push(`(plugin ${r.pluginVersion})`);
  for (const [label, xs] of [['Highlights', r.highlights], ['New', r.added], ['Improved', r.improved], ['Fixed', r.fixed]] as const) {
    if (xs.length) out.push('', label, ...xs.map((x) => `  • ${x}`));
  }
  console.log(out.join('\n'));
} catch (err) {
  console.error(`Release file is not valid: ${(err as Error).message}`);
  process.exit(1);
}
