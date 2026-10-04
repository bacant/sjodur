// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertProductionReady, loadAuthConfig } from "./config";
import { userFromClaims } from "./oidc";
import { safeReturnTo } from "./routes";

describe("safeReturnTo", () => {
  it("accepts only relative paths on this site", () => {
    expect(safeReturnTo("/app/ledger?x=1")).toBe("/app/ledger?x=1");
    expect(safeReturnTo(undefined)).toBe("/");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo("/auth/login")).toBe("/");
  });
});

describe("userFromClaims", () => {
  it("maps Keycloak claims", () => {
    expect(
      userFromClaims({
        sub: "abc",
        name: "Anna Beispiel",
        email: "anna@example.com",
        realm_access: { roles: ["user", "offline_access"] },
      }),
    ).toEqual({ sub: "abc", name: "Anna Beispiel", email: "anna@example.com", roles: ["user", "offline_access"] });
  });

  it("falls back to preferred_username and tolerates missing roles", () => {
    expect(userFromClaims({ sub: "abc", preferred_username: "anna" })).toEqual({
      sub: "abc",
      name: "anna",
      email: undefined,
      roles: [],
    });
    expect(() => userFromClaims({})).toThrow();
  });
});

describe("assertProductionReady", () => {
  it("refuses development defaults in production", () => {
    expect(() => assertProductionReady(loadAuthConfig({}), "production")).toThrow(/Refusing to start/);
  });

  it("accepts a complete production configuration", () => {
    const config = loadAuthConfig({
      SJODUR_PUBLIC_URL: "https://sjodur.example",
      SJODUR_OIDC_CLIENT_SECRET: "real-secret",
      SJODUR_SESSION_SECRET: "x".repeat(40),
      REDIS_URL: "redis://redis:6379",
    });
    expect(() => assertProductionReady(config, "production")).not.toThrow();
  });
});
