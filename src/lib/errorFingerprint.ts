// What makes two failures the same failure.
//
// PURE — no `@/db` — so the rule can be tested directly, which matters more here than usual: a
// fingerprint that is too specific turns one bug into two hundred rows and a digest nobody reads,
// and one that is too loose folds unrelated bugs together and hides the second one.
//
// THE RULE: a failure is its error type, its message with the variable parts taken out, and the
// first line of the stack that belongs to us. Everything else — the id in the URL, the row that
// happened to be missing, the framework frames underneath — varies between occurrences of the same
// bug and must not enter the identity.

/** How much stack is worth keeping. Enough to find the code; not enough to fill a column with it. */
const STACK_FRAMES = 8;

/** Messages longer than this are truncated before storage — the tail is never the useful part. */
const MAX_MESSAGE = 500;

/**
 * Replace the parts of a string that differ between occurrences of the same failure.
 *
 * Order matters: UUIDs and hex digests are matched before bare numbers, or the number rule would
 * chew them into fragments and defeat the point.
 */
export function normalizeMessage(raw: string): string {
  return raw
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\b[0-9a-f]{32,}\b/gi, '<hash>')
    // A quoted RSN, clan slug or key — the thing that was missing, which is never the bug.
    .replace(/'[^']{1,80}'/g, "'<v>'")
    .replace(/"[^"]{1,80}"/g, '"<v>"')
    .replace(/\b\d+\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The same treatment for a URL path, so `/c/theafkspot/events/91` and `/c/other/events/4` are one
 * route rather than two thousand.
 *
 * The clan slug becomes `<clan>` because the clan is recorded in its own column — keeping it in the
 * path too would split one bug across every clan that hit it.
 */
export function normalizePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.split('?')[0];
  return path
    .replace(/^\/c\/[a-z0-9-]{2,32}(?=\/|$)/, '/c/<clan>')
    .replace(/\/\d+(?=\/|$)/g, '/<n>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>');
}

/**
 * The first stack frame that is OURS.
 *
 * A stack usually opens with framework and node internals, which are identical across completely
 * unrelated bugs — fingerprinting on the top frame alone would fold half the app into one row. The
 * first frame mentioning our own source is the line somebody would actually open.
 */
export function ownFrame(stack: string | null | undefined): string | null {
  if (!stack) return null;
  for (const line of stack.split('\n').slice(1)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('at ')) continue;
    if (/node_modules|node:internal|\/next\/dist\//.test(trimmed)) continue;
    // `.next/` is the BUILD OUTPUT, not our code. Everything the server runs lives in a bundled
    // chunk, so without this the "own frame" of every failure in the app is a hashed chunk filename
    // — which is stable enough to fingerprint on and tells a reader nothing, and changes wholesale
    // on the next build. Falling through to the request path is far more useful.
    if (/[\\/]\.next[\\/]/.test(trimmed)) continue;
    // Strip the column, which moves whenever anything above it on the line does.
    return trimmed.replace(/:\d+:\d+\)?$/, '').replace(/^at\s+/, '');
  }
  return null;
}

/** Trim a stack to something worth storing: our frames first, framework noise dropped. */
export function trimStack(stack: string | null | undefined): string | null {
  if (!stack) return null;
  const lines = stack.split('\n').filter((l) => !/node:internal/.test(l));
  return lines.slice(0, STACK_FRAMES + 1).join('\n').slice(0, 4000);
}

export function truncateMessage(raw: string): string {
  return raw.length > MAX_MESSAGE ? `${raw.slice(0, MAX_MESSAGE - 1)}…` : raw;
}

/**
 * The identity of a failure.
 *
 * Plain text rather than a hash: it is read by a human on /staff/errors far more often than it is
 * compared by a machine, and "TypeError|cannot read x of undefined|src/lib/weekly.ts" answers the
 * question a hash would make you go and look up.
 */
export function fingerprintOf(opts: {
  name: string;
  message: string;
  stack?: string | null;
  path?: string | null;
}): string {
  const parts = [
    opts.name || 'Error',
    normalizeMessage(opts.message || '').slice(0, 200),
    ownFrame(opts.stack) ?? normalizePath(opts.path) ?? '',
  ];
  return parts.join('|').slice(0, 500);
}
