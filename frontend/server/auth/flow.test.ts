// @vitest-environment node
import { createServer, type Server } from "node:http";
import { Hono } from "hono";
import { OAuth2Server } from "oauth2-mock-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadAuthConfig, type AuthConfig } from "./config";
import { apiProxy, requireSameOrigin, sessionMiddleware, type AuthEnv } from "./middleware";
import { OidcClient } from "./oidc";
import { authRoutes } from "./routes";
import { MemorySessionStore } from "./session";

/**
 * Walks through the whole "backend for frontend" flow with a real (mock) OpenID
 * provider and a fake Spring backend that echoes the headers it receives.
 */

const provider = new OAuth2Server();
let backend: Server;
let backendUrl = "";
let lastBackendRequest: { path: string; headers: Record<string, string | string[] | undefined> } | null = null;

let config: AuthConfig;
let store: MemorySessionStore;
let app: Hono<AuthEnv>;

function cookieFrom(res: Response, name: string): string | undefined {
  const raw = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return raw?.split(";")[0];
}

beforeAll(async () => {
  await provider.issuer.keys.generate("RS256");
  await provider.start(0, "localhost");
  // Enrich tokens the way Keycloak does (name, email, realm roles).
  provider.service.on("beforeTokenSigning", (token) => {
    Object.assign(token.payload, {
      name: "Anna Beispiel",
      email: "anna@example.com",
      realm_access: { roles: ["user"] },
    });
  });

  backend = createServer((req, res) => {
    lastBackendRequest = { path: req.url ?? "", headers: req.headers };
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ sub: "johndoe", authorization: req.headers.authorization ?? null }));
  });
  await new Promise<void>((resolve) => backend.listen(0, "127.0.0.1", resolve));
  const address = backend.address();
  backendUrl = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";

  config = loadAuthConfig({
    SJODUR_OIDC_ISSUER: provider.issuer.url!,
    SJODUR_OIDC_CLIENT_ID: "sjodur-web",
    SJODUR_OIDC_CLIENT_SECRET: "secret",
    SJODUR_PUBLIC_URL: "http://localhost:3000",
    SJODUR_SESSION_SECRET: "test-session-secret-with-enough-length",
    SJODUR_API_URL: backendUrl,
  });
  store = new MemorySessionStore();
  const oidc = new OidcClient(config);

  app = new Hono<AuthEnv>();
  app.use("*", sessionMiddleware(store, config));
  app.route("/auth", authRoutes(store, oidc, config));
  app.use("/api/*", requireSameOrigin(config));
  app.all("/api/*", apiProxy(store, oidc, config));
});

afterAll(async () => {
  await provider.stop();
  await new Promise<void>((resolve) => backend.close(() => resolve()));
});

describe("login flow", () => {
  let loginCookie: string;
  let sessionCookie: string;

  it("redirects to the identity provider with PKCE, state and nonce", async () => {
    const res = await app.request("/auth/login?returnTo=/app");
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe(provider.issuer.url);
    expect(location.searchParams.get("client_id")).toBe("sjodur-web");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/auth/callback");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("nonce")).toBeTruthy();
    loginCookie = cookieFrom(res, "sjodur_login")!;
    expect(loginCookie).toBeTruthy();

    // The provider "logs the user in" and sends the code back to our callback.
    const providerRes = await fetch(location, { redirect: "manual" });
    expect(providerRes.status).toBe(302);
    const callback = new URL(providerRes.headers.get("location")!);
    expect(callback.pathname).toBe("/auth/callback");

    const cb = await app.request(callback.pathname + callback.search, { headers: { cookie: loginCookie } });
    expect(cb.status).toBe(302);
    expect(cb.headers.get("location")).toBe("/app");
    sessionCookie = cookieFrom(cb, "sjodur_session")!;
    expect(sessionCookie).toMatch(/^sjodur_session=[A-Za-z0-9_-]{43}$/);
    const flags = cb.headers.getSetCookie().find((c) => c.startsWith("sjodur_session="))!;
    expect(flags).toMatch(/HttpOnly/);
    expect(flags).toMatch(/SameSite=Lax/);
  });

  it("rejects a callback whose state does not match", async () => {
    const res = await app.request("/auth/callback?code=abc&state=wrong", { headers: { cookie: loginCookie } });
    expect(res.status).toBe(400);
  });

  it("exposes the user without any tokens", async () => {
    const res = await app.request("/auth/me", { headers: { cookie: sessionCookie } });
    const user = await res.json();
    expect(user).toEqual({ sub: "johndoe", name: "Anna Beispiel", email: "anna@example.com", roles: ["user"] });
    expect(JSON.stringify(user)).not.toMatch(/token/i);
  });

  it("proxies API calls with a Bearer token and without the session cookie", async () => {
    const res = await app.request("/api/me?x=1", { headers: { cookie: sessionCookie } });
    expect(res.status).toBe(200);
    expect(lastBackendRequest?.path).toBe("/api/me?x=1");
    expect(lastBackendRequest?.headers.authorization).toMatch(/^Bearer ey/);
    expect(lastBackendRequest?.headers.cookie).toBeUndefined();
    expect(lastBackendRequest?.headers["x-forwarded-host"]).toBe("localhost");
  });

  it("blocks cross-site writes but allows same-origin ones", async () => {
    const blocked = await app.request("/api/entries", {
      method: "POST",
      headers: { cookie: sessionCookie, "sec-fetch-site": "cross-site" },
    });
    expect(blocked.status).toBe(403);

    const allowed = await app.request("/api/entries", {
      method: "POST",
      headers: { cookie: sessionCookie, "sec-fetch-site": "same-origin" },
    });
    expect(allowed.status).toBe(200);
  });

  it("refreshes an expiring access token transparently", async () => {
    const id = sessionCookie.split("=")[1];
    const session = (await store.get(id))!;
    await store.set({ ...session, expiresAt: Date.now() - 1 }, 60);

    const res = await app.request("/api/me", { headers: { cookie: sessionCookie } });
    expect(res.status).toBe(200);
    const refreshed = (await store.get(id))!;
    // The mock provider rotates refresh tokens; the access token may be byte-identical within the same second.
    expect(refreshed.refreshToken).not.toBe(session.refreshToken);
    expect(refreshed.expiresAt).toBeGreaterThan(Date.now());
    expect(lastBackendRequest?.headers.authorization).toBe(`Bearer ${refreshed.accessToken}`);
  });

  it("logs out: session gone, cookie cleared, provider notified", async () => {
    const res = await app.request("/auth/logout", { headers: { cookie: sessionCookie } });
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/endsession");
    expect(location.searchParams.get("post_logout_redirect_uri")).toBe("http://localhost:3000/");
    expect(res.headers.getSetCookie().find((c) => c.startsWith("sjodur_session="))).toMatch(/Max-Age=0/);

    const me = await app.request("/auth/me", { headers: { cookie: sessionCookie } });
    expect(await me.json()).toBeNull();
  });

  it("proxies anonymous API calls without a token", async () => {
    await app.request("/api/public/ping");
    expect(lastBackendRequest?.headers.authorization).toBeUndefined();
  });
});
