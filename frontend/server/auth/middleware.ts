import { enhance, MiddlewareOrder } from "@universal-middleware/core";
import type { Context, Handler, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { proxy } from "hono/proxy";
import type { AuthConfig } from "./config";
import type { OidcClient } from "./oidc";
import type { Session, SessionStore, SessionUser } from "./session";

export const SESSION_COOKIE = "sjodur_session";

/** Hono environment shared by all auth-aware handlers. */
export type AuthEnv = {
  Variables: {
    session: Session | null;
  };
};

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

/**
 * CSRF protection for the cookie-authenticated API proxy: state-changing requests
 * must come from our own origin. Modern browsers send Sec-Fetch-Site; older ones
 * are checked against the Origin header. Requests without a session carry no
 * credentials and are left alone.
 */
export function isSameOriginRequest(headers: Headers, publicUrl: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none";
  const origin = headers.get("origin");
  if (origin) return origin === publicUrl;
  // No browser fetch metadata at all: treat as non-browser client, which cannot have our cookie.
  return true;
}

export function requireSameOrigin(config: AuthConfig): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    if (c.var.session && !SAFE_METHODS.has(c.req.method) && !isSameOriginRequest(c.req.raw.headers, config.publicUrl)) {
      return c.json({ error: "cross_site_request_rejected" }, 403);
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

/** Vike universal middleware: exposes the signed-in user as pageContext.user (see types/vike.d.ts). */
export const userContext = enhance(
  async (_request: Request, context: Universal.Context, runtime: unknown) => {
    const c = (runtime as { hono?: Context<AuthEnv> }).hono;
    const user: SessionUser | null = c?.get("session")?.user ?? null;
    return { ...context, user };
  },
  // A universal *middleware* (no path): it extends the context instead of answering the request.
  { name: "sjodur:user-context", order: MiddlewareOrder.AUTHENTICATION, immutable: false },
);
