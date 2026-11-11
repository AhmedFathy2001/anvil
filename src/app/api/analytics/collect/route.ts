import { forgetSession, isOperatorPattern, isPlatformStaff, trackLeave, trackPage } from '@/lib/analytics';
import { boundProps, isBotUserAgent, tenantOfBeacon, isSessionId, scrubPattern } from '@/lib/analyticsPattern';
import { classifyFirstTouch, clampLeaveMs, isViewportClass } from '@/lib/analyticsSource';
import { sessionUserIdForAnalytics } from '@/lib/auth';
import { resolveClanByHost, resolveClanBySlug } from '@/lib/clanContext';
import { getClientIp } from '@/lib/clientIp';

// Page views, from components/AnalyticsBeacon.
//
// ALWAYS 204. The caller is `navigator.sendBeacon`, which never reads the answer, and nothing a
// visitor's browser does here may surface as an error — not a malformed body, not a bot, not the
// database being down. Everything that is not a clean page view is dropped silently.
//
// Unauthenticated by necessity (most visitors are not signed in), so it trusts nothing it is sent:
// the pattern is scrubbed again server-side, the clan is only ever a lookup key against real clans,
// and the user comes from the signed session cookie, never from the body.

const MAX_BODY = 2_048;

// A per-IP budget kept in memory, not in the rate_limits table: that limiter writes a row per
// request, which would double the writes this route exists to make. Per-process is enough — the aim
// is to stop one client inflating a chart, not to enforce a contract.
const WINDOW_MS = 60_000;
const PER_WINDOW = 120; // a view and a leave per navigation
let windowStartedAt = 0;
const hits = new Map<string, number>();

function overBudget(ip: string): boolean {
  const now = Date.now();
  if (now - windowStartedAt > WINDOW_MS) {
    hits.clear();
    windowStartedAt = now;
  }
  const n = (hits.get(ip) ?? 0) + 1;
  hits.set(ip, n);
  return n > PER_WINDOW;
}

const done = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  try {
    if (isBotUserAgent(request.headers.get('user-agent'))) return done();
    if (overBudget(getClientIp(request))) return done();

    const raw = await request.text();
    if (raw.length > MAX_BODY) return done();
    const body = JSON.parse(raw) as { p?: unknown; s?: unknown; c?: unknown; w?: unknown; f?: unknown; l?: unknown };

    const pattern = scrubPattern(body.p);
    if (!pattern || !isSessionId(body.s)) return done();
    const userId = await sessionUserIdForAnalytics();
    if (await isPlatformStaff(userId)) {
      forgetSession(body.s);
      return done();
    }
    if (isOperatorPattern(pattern)) return done();

    // The page's own path names the clan; the host is the fallback for a custom domain, where pages
    // carry no prefix.
    const tenant = typeof body.c === 'string' ? tenantOfBeacon(body.c) : null;
    const clan =
      (tenant ? await resolveClanBySlug(tenant.slug, tenant.kind) : null) ??
      (await resolveClanByHost(request.headers.get('host')));

    // Time on page: a leave beacon names the page and how long it was open. Nothing else.
    const ms = clampLeaveMs(body.l);
    if (body.l !== undefined) {
      if (ms != null) trackLeave({ pattern, clanId: clan?.id ?? null, sessionId: body.s, ms });
      return done();
    }

    // First touch: only the tab's first view carries it (`f`), and only the HOST of the referrer plus
    // the standard campaign tags — all re-cleaned here, since a beacon is a request anybody can forge.
    const f = body.f && typeof body.f === 'object' ? (body.f as Record<string, unknown>) : null;
    const touch = f ? classifyFirstTouch({ host: f.r as string, source: f.s as string, medium: f.m as string, campaign: f.c as string, ref: f.f as string }) : null;
    trackPage({
      pattern,
      clanId: clan?.id ?? null,
      userId,
      sessionId: body.s,
      props: boundProps({
        vp: isViewportClass(body.w) ? body.w : null,
        ...(touch ? { src: touch.source, rh: touch.host, um: touch.medium, uc: touch.campaign, rf: touch.ref } : {}),
      }),
    });
  } catch {
    // A bad body is a dropped view, not an error.
  }
  return done();
}
