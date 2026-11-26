// Convert Anvil library guides into guide pieces (lib/guidePieces/convert). The guides themselves
// are not changed; clan guides are never touched. Dry run unless --apply.
//
//   DATABASE_URL=… npx tsx scripts/convert-guides-to-pieces.ts [--guide <id>]… [--apply] [--publish] [--replace]
//
//   --apply    write the pieces (otherwise: report what would be written)
//   --publish  pieces of a published guide are published (default: drafts, for an editor to check)
//   --replace  a guide that already has pieces gets its pieces rewritten (default: left alone)
//
// Meant for beta first, by hand, after reviewing the dry run.

async function main() {
  const args = process.argv.slice(2);
  const guideIds: number[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--guide') {
      const n = Number(args[++i]);
      if (!Number.isInteger(n) || n < 1) throw new Error('--guide takes a guide id');
      guideIds.push(n);
    } else if (!['--apply', '--publish', '--replace'].includes(args[i])) {
      throw new Error(`Unknown option ${args[i]}`);
    }
  }
  const apply = args.includes('--apply');
  const target = (() => {
    try {
      return new URL(process.env.DATABASE_URL ?? '').host || '(unset)';
    } catch {
      return '(unparsable)';
    }
  })();
  console.log(`${apply ? 'CONVERTING' : 'Dry run'} against ${target}${guideIds.length ? `, guides ${guideIds.join(', ')}` : ', every library guide'}`);
  const { convertLibraryGuides } = await import('../src/lib/guidePieces/convertStore');
  const report = await convertLibraryGuides({ guideIds, apply, publish: args.includes('--publish'), replace: args.includes('--replace') });
  for (const r of report) {
    console.log(`${r.outcome.padEnd(13)} #${r.guideId} ${r.slug}: ${r.pieces} pieces${r.skipped.length ? `, ${r.skipped.length} skipped` : ''}`);
    for (const s of r.skipped) console.log(`    skipped ${s.what}: ${s.why}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
