import { timingSafeEqual } from "node:crypto";
import { enhance, MiddlewareOrder } from "@universal-middleware/core";
import type { Context, Handler, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { proxy } from "hono/proxy";
import type { AppEnv } from "../env";
import { logger } from "../logging";
import type { AuthConfig } from "./config";
import type { OidcClient } from "./oidc";
import type { Session, SessionStore, SessionUser } from "./session";

export const SESSION_COOKIE = "sjodur_session";

/** Request logger when the logging middleware ran, the global logger otherwise (tests, tools). */
export function logOf(c: Context<AppEnv>) {
  return c.var.log ?? logger;
}

/** Hono environment of the auth handlers – the shared app environment (see server/env.ts). */
export type AuthEnv = AppEnv;

/** Access tokens are refreshed when they expire within this window. */
export const REFRESH_LEEWAY_MS = 30_000;

export function cookieOptions(config: AuthConfig) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function setSessionCookie(c: Context, config: AuthConfig, sessionId: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, { ...cookieOptions(config), maxAge: config.sessionTtlSeconds });
}

export function clearSessionCookie(c: Context, config: AuthConfig): void {
  deleteCookie(c, SESSION_COOKIE, cookieOptions(config));
}

/** Loads the session referenced by the cookie (if any) into c.var.session. */
export function sessionMiddleware(store: SessionStore, config: AuthConfig): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const id = getCookie(c, SESSION_COOKIE);
    const session = id ? await store.get(id) : null;
    if (id && !session) clearSessionCookie(c, config);
    c.set("session", session);
    await next();
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
export const CSRF_HEADER = "x-csrf-token";
export const CSRF_FORM_FIELD = "_csrf";

/**
 * First CSRF layer: state-changing requests must come from our own origin. Modern
 * browsers send Sec-Fetch-Site; older ones are checked against the Origin header.
 * Requests without any browser metadata come from non-browser clients, which
 * cannot carry our cookie (the token check below still applies to them).
 */
export function isSameOriginRequest(headers: Headers, publicUrl: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = headers.get("origin");
  if (origin) return origin === publicUrl;
  return true;
}

export function tokensMatch(expected: string, actual: string | undefined | null): boolean {
  if (!actual) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function csrfTokenFrom(c: Context<AuthEnv>, allowFormField: boolean): Promise<string | undefined> {
  const header = c.req.header(CSRF_HEADER);
  if (header) return header;
  if (!allowFormField) return undefined;
  const contentType = c.req.header("content-type") ?? "";
  if (!contentType.startsWith("application/x-www-form-urlencoded") && !contentType.startsWith("multipart/form-data")) {
    return undefined;
  }
  const body = await c.req.parseBody();
  const value = body[CSRF_FORM_FIELD];
  return typeof value === "string" ? value : undefined;
}

/**
 * CSRF protection for cookie-authenticated, state-changing requests – identical in
 * development and production. Two independent checks, both must pass:
 *   1. same-origin (Sec-Fetch-Site / Origin),
 *   2. the session's synchronizer token in the X-CSRF-Token header
 *      (or the _csrf form field where allowFormField is set, e.g. the logout form).
 * Safe methods and requests without a session pass through untouched.
 */
export function csrfProtection(
  config: AuthConfig,
  options: { allowFormField?: boolean } = {},
): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const session = c.var.session;
    if (!session || SAFE_METHODS.has(c.req.method)) return next();
    if (!isSameOriginRequest(c.req.raw.headers, config.publicUrl)) {
      return c.json({ error: "cross_site_request_rejected" }, 403);
    }
    if (!tokensMatch(session.csrfToken, await csrfTokenFrom(c, options.allowFormField ?? false))) {
      return c.json({ error: "csrf_token_missing_or_invalid" }, 403);
    }
    await next();
  };
}

export function needsRefresh(session: Session, now = Date.now()): boolean {
  return session.expiresAt - REFRESH_LEEWAY_MS <= now;
}

/**
 * Returns a session with a valid access token, refreshing it first if necessary.
 * Concurrent requests for the same session share one refresh (refresh tokens rotate,
 * so a second refresh with the old token would fail). Returns null if the session
 * could not be refreshed – the caller should then treat the user as signed out.
 */
export function createTokenRefresher(store: SessionStore, oidc: OidcClient, config: AuthConfig) {
  const inFlight = new Map<string, Promise<Session | null>>();

  return async function freshSession(session: Session): Promise<Session | null> {
    if (!needsRefresh(session)) return session;
    if (!session.refreshToken) return null;

    let pending = inFlight.get(session.id);
    if (!pending) {
      pending = (async () => {
        try {
          const tokens = await oidc.refresh(session.refreshToken!);
          const updated: Session = {
            ...session,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken ?? session.refreshToken,
            idToken: tokens.idToken ?? session.idToken,
            expiresAt: tokens.expiresAt,
          };
          await store.set(updated, config.sessionTtlSeconds);
          return updated;
        } catch {
          await store.delete(session.id);
          return null;
        } finally {
          inFlight.delete(session.id);
        }
      })();
      inFlight.set(session.id, pending);
    }
    return pending;
  };
}

/**
 * Forwards /api/* to the Spring backend. With a session, the access token is attached
 * as Bearer; without one the request goes through unauthenticated and the backend
 * answers 401 where it requires login.
 */
export function apiProxy(store: SessionStore, oidc: OidcClient, config: AuthConfig): Handler<AuthEnv> {
  const freshSession = createTokenRefresher(store, oidc, config);

  return async (c) => {
    const url = new URL(c.req.url);
    const headers: Record<string, string> = {
      ...c.req.header(),
      "x-forwarded-host": c.req.header("host") ?? url.host,
      "x-forwarded-proto": url.protocol.replace(":", ""),
    };
    // The session cookie is ours; the backend never sees it.
    delete headers.cookie;
    delete headers.Cookie;
    // Continue our trace in the backend (Micrometer Tracing reads W3C traceparent).
    if (c.var.traceparent) headers.traceparent = c.var.traceparent;

    if (c.var.session) {
      const session = await freshSession(c.var.session);
      if (!session) {
        clearSessionCookie(c, config);
        return c.json({ error: "session_expired" }, 401);
      }
      headers.authorization = `Bearer ${session.accessToken}`;
    }

    return proxy(`${config.apiUrl}${url.pathname}${url.search}`, { ...c.req, headers });
  };
}

/** Vike universal middleware: exposes pageContext.user and pageContext.csrfToken (see types/vike.d.ts). */
export const userContext = enhance(
  async (_request: Request, context: Universal.Context, runtime: unknown) => {
    const c = (runtime as { hono?: Context<AuthEnv> }).hono;
    const session = c?.get("session") ?? null;
    const user: SessionUser | null = session?.user ?? null;
    return { ...context, user, csrfToken: session?.csrfToken ?? null };
  },
  // A universal *middleware* (no path): it extends the context instead of answering the request.
  { name: "sjodur:user-context", order: MiddlewareOrder.AUTHENTICATION, immutable: false },
);
