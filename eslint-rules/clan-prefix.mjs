/**
 * Flag links and API calls that hard-code a clan-scoped path without the clan prefix.
 *
 * WHY A LINT RULE. A clan lives at `/c/<slug>/…`. A bare `/events/5` in a link or a fetch is wrong
 * there, and the two failures are not equally visible:
 *
 *   - a LINK lands on the apex and 404s. Annoying, obvious, findable by clicking.
 *   - a FETCH reaches the route with no clan at all. It does not error — the handler runs and
 *     answers a different question, or writes somewhere else. That one is silent, and it is the
 *     reason this is a rule and not a code review.
 *
 * TypeScript cannot help: `fetch('/api/admin/clan')` and `fetch(href('/api/admin/clan'))` are both
 * perfectly typed strings.
 *
 * HOW. Any string literal starting with `/` that lib/clanScopedPaths calls clan-scoped must not
 * appear directly as a `href`/`action` prop or as the first argument to `fetch`. Put it through
 * `useClanHref()` (client) or `clanHref`/`clanHrefs` (server) instead.
 *
 * Platform paths — /profile, /clans, /u/, /staff, /api/profile … — are left alone, because they are
 * the same URL from inside a clan or outside it. That list is the one in lib/clanScopedPaths, and
 * this rule imports the decision rather than restating it: two copies would eventually disagree,
 * and the disagreement would be invisible.
 *
 * ESCAPE HATCH. A deliberate link out of the clan writes the reason down:
 *
 *   // clan-prefix: platform -- the directory is the apex's, not this clan's
 *
 * on or above the line.
 */

import { isClanScopedPath } from '../src/lib/clanScopedPaths.ts';

const ESCAPE = /clan-prefix:\s*platform/;

/** Props whose value is a URL the browser will follow. */
const URL_PROPS = new Set(['href', 'action', 'src']);

export default {
  meta: {
    type: 'problem',
    docs: { description: 'clan-scoped paths must carry the clan prefix' },
    schema: [],
    messages: {
      bareLink:
        '"{{path}}" belongs to a clan, so it needs the clan prefix. Use useClanHref() in a client ' +
        'component or clanHref()/clanHrefs() on the server. Without it this lands on the apex.',
      rawLink:
        'Import ClanLink from @/components/ClanLink instead of next/link. A plain Link cannot know ' +
        'about the clan prefix, and its href is often a variable this rule cannot read — which is ' +
        'how ten bare clan paths reached a rendered page while lint reported zero. ClanLink passes ' +
        'platform paths through untouched, so it is correct everywhere Link was.',
      opaqueHref:
        'This href arrives in a variable, so this rule cannot tell whether it belongs to a clan — ' +
        'and a raw <a> takes it literally. Use ClanLink, which resolves the prefix at render ' +
        'whatever the path turns out to be. One link written this way on the events page pointed at ' +
        'the apex and 404\'d for every member while lint reported zero problems.',
      bareFetch:
        '"{{path}}" belongs to a clan, so it needs the clan prefix. Use useClanHref() in a client ' +
        'component or clanHref()/clanHrefs() on the server. Without it the request reaches the ' +
        'route with NO clan — which does not error, it answers a different question.',
    },
  },
  create(context) {
    const source = context.sourceCode ?? context.getSourceCode();

    /** Is this line (or the one above) excused? */
    function excused(node) {
      // The node itself, and — for a JSX attribute — the element carrying it. An attribute has
      // nowhere to hang a comment of its own: JSX has no syntax for one inside an opening tag, so an
      // escape hatch that only reads the attribute is an escape hatch nobody can use.
      for (const n of [node, node.parent, node.parent?.parent]) {
        if (!n?.loc) continue;
        const line = source.lines[n.loc.start.line - 1] ?? '';
        if (ESCAPE.test(line)) return true;
        if ((source.getCommentsBefore(n) ?? []).some((c) => ESCAPE.test(c.value))) return true;
      }
      return false;
    }

    function check(node, value, messageId) {
      if (typeof value !== 'string' || !isClanScopedPath(value)) return;
      if (excused(node)) return;
      context.report({ node, messageId, data: { path: value } });
    }

    return {
      // next/link itself. The href-literal check below can only see paths written out in full; a
      // component storing its targets as data and rendering <Link href={item.href}> slips past it
      // entirely. One link component removes the possibility rather than trying to detect it.
      "ImportDeclaration[source.value='next/link']"(node) {
        if (context.filename?.endsWith('components/ClanLink.tsx')) return;
        if (excused(node)) return;
        context.report({ node, messageId: 'rawLink' });
      },

      // href="/events/5" and href={"/events/5"}
      //
      // Only where the URL is USED to navigate: a DOM element, or next/link. A capitalised component
      // taking an `href` prop is being handed data, and what it does with that data is its own
      // business — if it navigates with a bare path, the violation shows up inside it, at the <a> or
      // <Link> that actually does the navigating. Flagging both places would mean every wrapper
      // component needed an escape comment saying "no really, the thing I forward to handles it".
      //
      // <ClanLink> is exempt by this rule too, which is the point of it existing.
      JSXAttribute(node) {
        if (!URL_PROPS.has(node.name?.name)) return;
        const tag = node.parent?.name?.name;
        const navigates = typeof tag === 'string' && (tag === tag.toLowerCase() || tag === 'Link');
        if (!navigates) return;
        const v = node.value;
        if (v?.type === 'Literal') return check(v, v.value, 'bareLink');
        if (v?.type === 'JSXExpressionContainer' && v.expression?.type === 'Literal') {
          return check(v.expression, v.expression.value, 'bareLink');
        }

        // AN href THIS RULE CANNOT READ, on an element that navigates.
        //
        // `<a href={n.href}>` where n.href is built elsewhere as `/events/<id>`. Every check above
        // reads the path, so a path arriving in a variable was invisible — and exactly one link on
        // the events page was written this way, pointed at the apex, and 404'd for everybody. The
        // literal checks had reported zero.
        //
        // So: on a raw <a> or a <Link>, an unreadable href is itself the violation. ClanLink is
        // exempt (it resolves the prefix at render), and so is anything that has already said it is
        // leaving the site — an external link has no clan to belong to.
        if (node.name.name !== 'href') return;
        if (v?.type !== 'JSXExpressionContainer') return;
        if (context.filename?.endsWith('components/ClanLink.tsx')) return;

        const expr = v.expression;

        // READABLE ENOUGH. A template literal whose first chunk is a fragment, an absolute URL or a
        // scheme is not a site path however the rest interpolates — `#${id}` and `https://${host}`
        // have no clan to belong to, and flagging them would train people to excuse the rule.
        const head =
          expr?.type === 'TemplateLiteral' ? (expr.quasis[0]?.value?.raw ?? '') : '';
        if (/^(#|https?:|mailto:|tel:|\/\/)/.test(head)) return;

        // ALREADY RESOLVED. clanUrl()/useClanUrl() exist to answer exactly this question, so an href
        // that came out of one is the correct spelling, not a violation.
        if (expr?.type === 'CallExpression') {
          const callee = expr.callee?.name ?? expr.callee?.property?.name ?? '';
          if (/^(clanUrl|clanHref|clanHrefs|withClanPrefix)$/.test(callee)) return;
        }

        const attrs = node.parent?.attributes ?? [];
        const external = attrs.some((a) => {
          if (a.type !== 'JSXAttribute') return false;
          if (a.name?.name === 'target') return true;
          if (a.name?.name === 'rel' && String(a.value?.value ?? '').includes('noopener')) return true;
          return false;
        });
        if (external || excused(node)) return;
        context.report({ node, messageId: 'opaqueHref' });
      },

      // fetch('/api/admin/clan')
      "CallExpression[callee.name='fetch']"(node) {
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (arg.type === 'Literal') check(arg, arg.value, 'bareFetch');
        // fetch(`/api/events/${id}/tiles`) — the leading quasi is enough to classify it.
        else if (arg.type === 'TemplateLiteral' && arg.quasis.length > 0) {
          const head = arg.quasis[0].value.cooked ?? '';
          if (head.startsWith('/')) check(arg, head, 'bareFetch');
        }
      },

      // redirect('/admin/dashboard') — a server component sending you somewhere.
      //
      // Same failure as a link, arrived at differently: without the prefix it lands on the apex,
      // where the page it names does not exist. Common in guards, which makes it the path someone
      // takes precisely when something has already gone wrong.
      "CallExpression[callee.name='redirect']"(node) {
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (arg.type === 'Literal') check(arg, arg.value, 'bareLink');
        else if (arg.type === 'TemplateLiteral' && arg.quasis.length > 0) {
          const head = arg.quasis[0].value.cooked ?? '';
          if (head.startsWith('/')) check(arg, head, 'bareLink');
        }
      },

      // window.location.href = '/api/…' — navigating by assignment, which downloads use because
      // they want the browser to fetch the file rather than the app to route to it. Same failure as
      // any other link, different shape, so the checks above never saw it.
      "AssignmentExpression[left.property.name='href']"(node) {
        const r = node.right;
        if (r?.type === 'Literal') check(r, r.value, 'bareLink');
        else if (r?.type === 'TemplateLiteral' && r.quasis.length > 0) {
          const head = r.quasis[0].value.cooked ?? '';
          if (head.startsWith('/')) check(r, head, 'bareLink');
        }
      },

      // router.push('/events/5')
      "CallExpression[callee.property.name=/^(push|replace)$/]"(node) {
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (arg.type === 'Literal') check(arg, arg.value, 'bareLink');
        else if (arg.type === 'TemplateLiteral' && arg.quasis.length > 0) {
          const head = arg.quasis[0].value.cooked ?? '';
          if (head.startsWith('/')) check(arg, head, 'bareLink');
        }
      },
    };
  },
};
