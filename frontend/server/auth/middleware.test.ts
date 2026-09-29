// @vitest-environment node
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { loadAuthConfig } from "./config";
import {
  CSRF_HEADER,
  createTokenRefresher,
  csrfProtection,
  isSameOriginRequest,
  needsRefresh,
  tokensMatch,
  type AuthEnv,
} from "./middleware";
import type { OidcClient } from "./oidc";
import { MemorySessionStore, type Session } from "./session";

const config = loadAuthConfig({ SJODUR_PUBLIC_URL: "https://sjodur.example" });

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    user: { sub: "42", name: "Anna", roles: [] },
    csrfToken: "token-abc",
    accessToken: "old",
    refreshToken: "rt",
    expiresAt: Date.now() + 300_000,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("isSameOriginRequest", () => {
  it("trusts fetch metadata first", () => {
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-origin" }), config.publicUrl)).toBe(true);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "none" }), config.publicUrl)).toBe(true);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "cross-site" }), config.publicUrl)).toBe(false);
    expect(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-site" }), config.publicUrl)).toBe(false);
  });

  it("falls back to the Origin header", () => {
    expect(isSameOriginRequest(new Headers({ origin: "https://sjodur.example" }), config.publicUrl)).toBe(true);
    expect(isSameOriginRequest(new Headers({ origin: "https://evil.example" }), config.publicUrl)).toBe(false);
  });

  it("lets non-browser requests through", () => {
    expect(isSameOriginRequest(new Headers(), config.publicUrl)).toBe(true);
  });
});

describe("csrfProtection", () => {
  function appWithSession(s: Session | null, allowFormField = false) {
    const app = new Hono<AuthEnv>();
    app.use("*", async (c, next) => {
      c.set("session", s);
      await next();
    });
    app.use("/api/*", csrfProtection(config, { allowFormField }));
    app.all("/api/*", (c) => c.text("ok"));
    return app;
  }

  it("rejects cross-site writes even with a valid token", async () => {
    const res = await appWithSession(session()).request("/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site", [CSRF_HEADER]: "token-abc" },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "cross_site_request_rejected" });
  });

  it("rejects same-origin writes without or with a wrong token", async () => {
    const app = appWithSession(session());
    const missing = await app.request("/api/x", { method: "POST", headers: { "sec-fetch-site": "same-origin" } });
    expect(missing.status).toBe(403);
    expect(await missing.json()).toEqual({ error: "csrf_token_missing_or_invalid" });
    const wrong = await app.request("/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", [CSRF_HEADER]: "token-xyz" },
    });
    expect(wrong.status).toBe(403);
  });

  it("allows same-origin writes with the session token", async () => {
    const res = await appWithSession(session()).request("/api/x", {
      method: "DELETE",
      headers: { "sec-fetch-site": "same-origin", [CSRF_HEADER]: "token-abc" },
    });
    expect(res.status).toBe(200);
  });

  it("accepts the token as a form field only where allowed", async () => {
    const body = new URLSearchParams({ _csrf: "token-abc" }).toString();
    const headers = { "sec-fetch-site": "same-origin", "content-type": "application/x-www-form-urlencoded" };
    expect((await appWithSession(session(), true).request("/api/x", { method: "POST", headers, body })).status).toBe(
      200,
    );
    expect((await appWithSession(session(), false).request("/api/x", { method: "POST", headers, body })).status).toBe(
      403,
    );
  });

  it("leaves reads and anonymous requests alone", async () => {
    const app = appWithSession(session());
    expect((await app.request("/api/x", { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(200);
    expect(
      (await appWithSession(null).request("/api/x", { method: "POST", headers: { "sec-fetch-site": "cross-site" } }))
        .status,
    ).toBe(200);
  });

  it("compares tokens in constant time and rejects empty ones", () => {
    expect(tokensMatch("abc", "abc")).toBe(true);
    expect(tokensMatch("abc", "abd")).toBe(false);
    expect(tokensMatch("abc", "ab")).toBe(false);
    expect(tokensMatch("abc", undefined)).toBe(false);
    expect(tokensMatch("abc", "")).toBe(false);
  });
});

describe("token refresh", () => {
  it("decides based on the leeway", () => {
    expect(needsRefresh(session({ expiresAt: Date.now() + 60_000 }))).toBe(false);
    expect(needsRefresh(session({ expiresAt: Date.now() + 10_000 }))).toBe(true);
    expect(needsRefresh(session({ expiresAt: Date.now() - 1 }))).toBe(true);
  });

  it("refreshes once for concurrent requests and stores the new tokens", async () => {
    const store = new MemorySessionStore();
    const expired = session({ expiresAt: Date.now() - 1 });
    await store.set(expired, 60);
    const refresh = vi.fn(async () => ({ accessToken: "new", refreshToken: "rt2", expiresAt: Date.now() + 300_000 }));
    const fresh = createTokenRefresher(store, { refresh } as unknown as OidcClient, config);

    const [a, b] = await Promise.all([fresh(expired), fresh(expired)]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(a?.accessToken).toBe("new");
    expect(b).toBe(a);
    expect((await store.get("s1"))?.refreshToken).toBe("rt2");
  });

  it("ends the session when the refresh fails", async () => {
    const store = new MemorySessionStore();
    const expired = session({ expiresAt: Date.now() - 1 });
    await store.set(expired, 60);
    const refresh = vi.fn(async () => {
      throw new Error("invalid_grant");
    });
    const fresh = createTokenRefresher(store, { refresh } as unknown as OidcClient, config);

    expect(await fresh(expired)).toBeNull();
    expect(await store.get("s1")).toBeNull();
  });
});
