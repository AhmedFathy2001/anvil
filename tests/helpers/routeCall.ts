// Calling a route handler from a test as a signed-in person.
//
// The routes read cookies()/headers(); outside Next there is no request scope, so each call runs
// inside a bare one carrying the request's own headers and a real signed session cookie (the same
// one lib/auth mints at login), and the clan header exactly as middleware forwards it.
import { AsyncLocalStorage } from 'node:async_hooks';

import { clanHeaders } from './clanHeader.ts';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

type Handler<P> = (request: Request, ctx: { params: Promise<P> }) => Promise<Response>;

export async function callRoute<P>(
  handler: Handler<P>,
  opts: {
    /** `users.id` of the person calling; omitted = signed out. */
    userId?: number;
    /** The clan the request is addressed to (`/c/<slug>/…`); omitted = the apex. */
    slug?: string;
    method?: string;
    body?: unknown;
    params?: P;
    /** Extra request headers (e.g. `sec-fetch-site`, as a browser sends it). */
    headers?: Record<string, string>;
    /** Query string for the request URL, without the `?`. */
    query?: string;
  },
): Promise<{ status: number; json: Record<string, unknown> }> {
  const { signUserToken } = await import('../../src/lib/auth.ts');
  const { workAsyncStorage } = await import('next/dist/server/app-render/work-async-storage.external.js');
  const { workUnitAsyncStorage } = await import('next/dist/server/app-render/work-unit-async-storage.external.js');
  const { RequestCookiesAdapter } = await import('next/dist/server/web/spec-extension/adapters/request-cookies.js');
  const { HeadersAdapter } = await import('next/dist/server/web/spec-extension/adapters/headers.js');
  const { RequestCookies } = await import('next/dist/server/web/spec-extension/cookies.js');

  // One address per caller, so the per-address throttles count each test person on their own.
  const ip = `10.${((opts.userId ?? 0) >> 16) & 255}.${((opts.userId ?? 0) >> 8) & 255}.${(opts.userId ?? 0) & 255}`;
  const headers = new Headers({ 'Content-Type': 'application/json', 'x-forwarded-for': ip, ...(opts.slug ? clanHeaders(opts.slug) : {}), ...(opts.headers ?? {}) });
  const cookieHeaders = new Headers();
  if (opts.userId != null) {
    cookieHeaders.set('cookie', `admin_session=${encodeURIComponent(signUserToken(opts.userId, 'test', 'member'))}`);
  }
  const request = new Request(`https://example.test/api/test${opts.query ? `?${opts.query}` : ''}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const store = {
    type: 'request',
    phase: 'render',
    headers: HeadersAdapter.seal(headers),
    cookies: RequestCookiesAdapter.seal(new RequestCookies(cookieHeaders)),
  };
  const res = await workAsyncStorage.run({ route: '/test' } as never, () =>
    workUnitAsyncStorage.run(store as never, () => handler(request, { params: Promise.resolve(opts.params ?? ({} as P)) })),
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}
