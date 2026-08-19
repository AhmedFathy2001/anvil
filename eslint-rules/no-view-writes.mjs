/**
 * Forbid naming the `clan_roster` VIEW anywhere inside a write statement.
 *
 * WHY A LINT RULE. `clanRoster` is a Postgres VIEW over `clan_memberships` + `accounts`. A view can
 * be SELECTed from, but it cannot appear in an UPDATE/DELETE's WHERE or RETURNING — Postgres
 * rejects the whole statement at parse time with "missing FROM-clause entry for table clan_roster".
 * The write never applies.
 *
 * TypeScript cannot catch this. `clanRoster.id` is a perfectly real column object of a perfectly
 * real Drizzle table; `eq(clanRoster.id, x)` and `eq(accounts.id, x)` typecheck identically. Nothing
 * distinguishes them until the query reaches the server.
 *
 * WE SHIPPED FOUR. Three were found only by running the cron against a live two-clan database, and
 * the fourth by scanning for the pattern afterwards:
 *
 *   - the stats sweep's unranked flip, which 500'd the whole tick — and, because the flip is what
 *     pushes `next_due_at` out, re-fetched the same dead accounts from Jagex every 15 minutes
 *     forever;
 *   - the weekly refresh's copy of the same statement;
 *   - "clear my other primaries" on the profile;
 *   - auto-claim-on-play's RETURNING, inside a function that swallows its own errors — so it
 *     failed as a silent no-op with nothing in any log.
 *
 * That last one is the argument for this rule. A statement that throws gets noticed. One that
 * throws inside a best-effort try/catch is indistinguishable from a feature nobody uses.
 *
 * THE FIX IS ALWAYS THE SAME SHAPE: write the real table, and hop seat -> account in the statement.
 *
 *   .where(inArray(clanRoster.id, seatIds))
 *   .where(inArray(accounts.id,
 *     db.select({ id: clanMemberships.accountId })
 *       .from(clanMemberships).where(inArray(clanMemberships.id, seatIds))))
 *
 * Reads are untouched — SELECTing the view is the entire reason it exists.
 */

const VIEW = 'clanRoster';
const WRITES = new Set(['update', 'delete', 'insert']);

/**
 * The method names along one call chain, innermost-last: `db.update(t).set(x).where(y)` -> update,
 * set, where. Used to classify the chain a reference sits in.
 */
function chainMethods(node) {
  const names = [];
  for (let n = node; n; ) {
    if (n.type === 'CallExpression') {
      const callee = n.callee;
      if (callee?.type === 'MemberExpression') {
        names.push(callee.property?.name);
        n = callee.object;
      } else {
        break;
      }
    } else if (n.type === 'MemberExpression') {
      n = n.object;
    } else {
      break;
    }
  }
  return names;
}

/**
 * What kind of statement is this chain? A chain containing `select`/`from` is a READ — including a
 * subquery nested inside a write, which is both legal and the recommended fix — so it wins over any
 * write verb further out. Otherwise the write verb, if any.
 */
function classify(node) {
  const names = chainMethods(node);
  if (names.includes('select') || names.includes('from')) return 'read';
  return names.find((n) => WRITES.has(n)) ?? null;
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'clan_roster is a view; it cannot appear in a write statement' },
    schema: [],
    messages: {
      viewAsTarget:
        'clan_roster is a VIEW and cannot be the target of a {{verb}} — it has no rules or triggers, ' +
        'so Postgres refuses the write. Write clanMemberships / accounts instead.',
      viewInWrite:
        'clan_roster is a VIEW and cannot appear in a {{verb}} — Postgres rejects the statement at ' +
        'parse time and the write never applies. Name the real table (accounts / clanMemberships) ' +
        'and hop seat -> account with a subquery.',
    },
  },
  create(context) {
    return {
      // `db.update(clanRoster)` / `.delete(...)` / `.insert(...)` — the view as the write TARGET,
      // passed as a bare identifier rather than a `clanRoster.col` reference, so the selector below
      // never sees it. None exist today; this keeps it that way.
      'CallExpression > MemberExpression.callee'(node) {
        if (!WRITES.has(node.property?.name)) return;
        const arg = node.parent.arguments?.[0];
        if (arg?.type === 'Identifier' && arg.name === VIEW) {
          context.report({ node: arg, messageId: 'viewAsTarget', data: { verb: node.property.name.toUpperCase() } });
        }
      },
      // Any `clanRoster.<col>` reference; then ask what kind of statement it sits in.
      [`MemberExpression[object.name="${VIEW}"]`](node) {
        for (let p = node.parent, hops = 0; p && hops < 40; p = p.parent, hops++) {
          if (p.type === 'CallExpression') {
            const kind = classify(p);
            // A read wins as soon as one is found: the innermost chain containing this reference is
            // the one that decides, so a `db.select().from(clanRoster)` subquery stops the walk
            // before it reaches the write it is nested in.
            if (kind === 'read') return;
            if (kind) {
              context.report({ node, messageId: 'viewInWrite', data: { verb: kind.toUpperCase() } });
              return;
            }
          }
          // Statement boundary — a write chain never spans one.
          if (p.type.endsWith('Statement') && p.type !== 'ExpressionStatement' && p.type !== 'ReturnStatement') return;
        }
      },
    };
  },
};
