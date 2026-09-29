import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AuthConfig } from "./config";
import { type AuthEnv, clearSessionCookie, cookieOptions, logOf, setSessionCookie } from "./middleware";
import { OidcClient, userFromClaims } from "./oidc";
import { newCsrfToken, newSessionId, type Session, type SessionStore } from "./session";

const LOGIN_COOKIE = "sjodur_login";
const LOGIN_COOKIE_MAX_AGE = 10 * 60;

interface LoginState {
  codeVerifier: string;
  state: string;
  nonce: string;
  returnTo: string;
}

/** Only relative paths are accepted as return targets, never other origins. */
export function safeReturnTo(value: string | undefined, fallback = "/"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/auth/")) return fallback;
  return value;
}

export function authRoutes(store: SessionStore, oidc: OidcClient, config: AuthConfig): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>();

  app.get("/login", async (c) => {
    if (c.var.session) return c.redirect(safeReturnTo(c.req.query("returnTo")));

    const { codeVerifier, codeChallenge } = await OidcClient.pkce();
    const login: LoginState = {
      codeVerifier,
      state: OidcClient.randomState(),
      nonce: OidcClient.randomNonce(),
      returnTo: safeReturnTo(c.req.query("returnTo")),
    };
    await setSignedCookie(c, LOGIN_COOKIE, JSON.stringify(login), config.sessionSecret, {
      ...cookieOptions(config),
      maxAge: LOGIN_COOKIE_MAX_AGE,
    });

    try {
      const url = await oidc.loginUrl({ state: login.state, nonce: login.nonce, codeChallenge });
      return c.redirect(url.href);
    } catch (error) {
      logOf(c).error({ err: error }, "OIDC discovery failed");
      return c.text("Login is temporarily unavailable.", 503);
    }
  });

  app.get("/callback", async (c) => {
    const raw = await getSignedCookie(c, config.sessionSecret, LOGIN_COOKIE);
    deleteCookie(c, LOGIN_COOKIE, cookieOptions(config));
    if (!raw) return c.text("Login expired, please try again.", 400);
    const login = JSON.parse(raw) as LoginState;

    try {
      const tokens = await oidc.exchangeCode(new URL(c.req.url), {
        codeVerifier: login.codeVerifier,
        state: login.state,
        nonce: login.nonce,
      });
      if (!tokens.claims) return c.text("Identity provider returned no ID token.", 502);

      const session: Session = {
        id: newSessionId(),
        user: userFromClaims(tokens.claims),
        csrfToken: newCsrfToken(),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        idToken: tokens.idToken,
        expiresAt: tokens.expiresAt,
        createdAt: Date.now(),
      };
      await store.set(session, config.sessionTtlSeconds);
      setSessionCookie(c, config, session.id);
      return c.redirect(login.returnTo);
    } catch (error) {
      logOf(c).warn({ err: error }, "OIDC callback failed");
      return c.text("Login failed, please try again.", 400);
    }
  });

  /** POST only (a GET link could be triggered cross-site); protected by csrfProtection in server/hono.ts. */
  app.post("/logout", async (c) => {
    const session = c.var.session;
    if (session) await store.delete(session.id);
    clearSessionCookie(c, config);
    try {
      const url = await oidc.logoutUrl(session?.idToken);
      return c.redirect(url.href);
    } catch {
      return c.redirect("/");
    }
  });

  /** The signed-in user and the CSRF token for client-side code. Never returns OAuth tokens. */
  app.get("/me", (c) => c.json({ user: c.var.session?.user ?? null, csrfToken: c.var.session?.csrfToken ?? null }));

  return app;
}
