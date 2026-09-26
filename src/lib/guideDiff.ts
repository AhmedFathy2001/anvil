// A line diff for the "the library version changed — what's different?" view. PURE.
//
// Plain LCS over lines: guides are a few hundred lines at most, so the O(n·m) table is a few hundred
// thousand cells and there is no reason to reach for Myers. Trimmed common prefix/suffix first,
// which is where almost all of a real edit's lines are.

export type DiffOp = { kind: 'same' | 'add' | 'del'; text: string };

export function diffLines(before: string, after: string): DiffOp[] {
  const a = before.replace(/\r\n?/g, '\n').split('\n');
  const b = after.replace(/\r\n?/g, '\n').split('\n');

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;
  // lcs[i][j] = LCS length of midA[i..] and midB[j..]
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = midA[i] === midB[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const ops: DiffOp[] = a.slice(0, start).map((text) => ({ kind: 'same' as const, text }));
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (midA[i] === midB[j]) {
      ops.push({ kind: 'same', text: midA[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ kind: 'del', text: midA[i++] });
    } else {
      ops.push({ kind: 'add', text: midB[j++] });
    }
  }
  while (i < n) ops.push({ kind: 'del', text: midA[i++] });
  while (j < m) ops.push({ kind: 'add', text: midB[j++] });
  for (const text of a.slice(endA)) ops.push({ kind: 'same', text });
  return ops;
}

/** Counts for a one-line summary: "+12 −3". */
export function diffStats(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.kind === 'add') added++;
    else if (op.kind === 'del') removed++;
  }
  return { added, removed };
}

/**
 * Collapse long runs of unchanged lines to `context` lines either side of a change, so the view
 * shows what moved rather than the whole guide. A collapsed run becomes one `{ kind: 'skip' }` row.
 */
export function withContext(ops: DiffOp[], context = 2): (DiffOp | { kind: 'skip'; count: number })[] {
  const keep = new Array(ops.length).fill(false);
  ops.forEach((op, idx) => {
    if (op.kind === 'same') return;
    for (let k = Math.max(0, idx - context); k <= Math.min(ops.length - 1, idx + context); k++) keep[k] = true;
  });
  const out: (DiffOp | { kind: 'skip'; count: number })[] = [];
  let skipped = 0;
  ops.forEach((op, idx) => {
    if (keep[idx]) {
      if (skipped) out.push({ kind: 'skip', count: skipped });
      skipped = 0;
      out.push(op);
    } else {
      skipped++;
    }
  });
  if (skipped) out.push({ kind: 'skip', count: skipped });
  return out;
}
