// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MemorySessionStore, newSessionId, type Session } from "./session";

function session(id = newSessionId()): Session {
  return {
    id,
    user: { sub: "42", name: "Anna", roles: ["user"] },
    csrfToken: "csrf",
    accessToken: "at",
    refreshToken: "rt",
    expiresAt: Date.now() + 300_000,
    createdAt: Date.now(),
  };
}

describe("MemorySessionStore", () => {
  it("stores and returns sessions until they expire", async () => {
    let now = 1_000_000;
    const store = new MemorySessionStore(() => now);
    const s = session();
    await store.set(s, 60);

    expect(await store.get(s.id)).toEqual(s);
    now += 61_000;
    expect(await store.get(s.id)).toBeNull();
    expect(store.size).toBe(0);
  });

  it("deletes sessions", async () => {
    const store = new MemorySessionStore();
    const s = session();
    await store.set(s, 60);
    await store.delete(s.id);
    expect(await store.get(s.id)).toBeNull();
  });

  it("generates unguessable ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newSessionId()));
    expect(ids.size).toBe(1000);
    expect(newSessionId()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});
