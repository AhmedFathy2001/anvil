/**
 * Flag queries on clan-scoped tables that carry no clan filter.
 *
 * WHY A LINT RULE. The multi-clan conversion has one failure mode that matters, and it is silent: a
 * query that forgets `clan_id` returns another clan's rows, and nothing errors. We shipped exactly
 * that — `getSetting` took a clanId and then filtered on `key` alone, and it passed typecheck, lint
 * and 25 test suites while every clan served the FIRST clan's configuration. Only a two-host request
 * against a running server exposed it.
 *
 * TypeScript cannot catch this: `eq(events.id, id)` and `eq(events.clanId, clanId)` are both
 * perfectly well typed. So the check has to be structural — does this query mention the clan at all?
 *
 * HOW. For any query chain that reads a clan-scoped table (`.from(events)`, `db.query.events.…`),
 * the same statement must also mention the clan. That is deliberately a low bar: it does not prove
 * the filter is CORRECT, only that the author thought about it. It converts "I forgot" — the entire
 * bug class — into a build failure, and leaves "I got it subtly wrong" to review and tests.
 *
 * ESCAPE HATCH. Some reads genuinely span clans: the platform staff panel, cron sweeps that iterate
 * every clan, global player lookups. Those write the reason down:
 *
 *   // clan-scope: global -- the sweep runs across every clan by design
 *
 * on, above, or inside the statement. An unexplained cross-clan read is a bug; an explained one is a
 * decision, and the comment is what makes the difference reviewable.
 */

// Tables carrying clan_id directly.
const ROOT_TABLES = new Set([
  'events',
  'clanMembers',
  'weeklyCompetitions',
  'eventPresets',
  'tileLibrary',
  'feedback',
  'settings',
]);

// Anything that counts as "this query knows about the clan".
const CLAN_MARKERS = /\bclanId\b|\bclan_id\b|\bclanScope\b|\bforClan\b/;
const ESCAPE = /clan-scope:\s*global/;

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Require a clan filter on queries against clan-scoped tables' },
    schema: [],
    messages: {
      unscoped:
        "Query on clan-scoped table '{{table}}' has no clan filter. Add the clan predicate, or " +
        'document the cross-clan read with `// clan-scope: global -- <why>`.',
    },
  },

  create(context) {
    const source = context.sourceCode ?? context.getSourceCode();

    /** The statement the chain sits in — what we read text and comments from. */
    function statementOf(node) {
      let n = node;
      while (n.parent && !/Statement|Declaration/.test(n.parent.type)) n = n.parent;
      return n.parent ?? n;
    }

    function excused(stmt) {
      const around = [
        ...(source.getCommentsBefore(stmt) ?? []),
        ...(source.getCommentsInside(stmt) ?? []),
        ...(source.getCommentsAfter(stmt) ?? []),
      ];
      return around.some((c) => ESCAPE.test(c.value));
    }

    function check(node, table) {
      if (!ROOT_TABLES.has(table)) return;
      const stmt = statementOf(node);
      const text = source.getText(stmt);
      if (CLAN_MARKERS.test(text)) return;
      if (excused(stmt)) return;
      context.report({ node, messageId: 'unscoped', data: { table } });
    }

    return {
      // db.select().from(events)
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'from' &&
          node.arguments.length === 1 &&
          node.arguments[0].type === 'Identifier'
        ) {
          check(node, node.arguments[0].name);
        }
      },

      // db.query.events.findFirst(...) / .findMany(...)
      MemberExpression(node) {
        if (
          node.object.type === 'MemberExpression' &&
          node.object.property.type === 'Identifier' &&
          node.object.property.name === 'query' &&
          node.property.type === 'Identifier'
        ) {
          check(node, node.property.name);
        }
      },
    };
  },
};
