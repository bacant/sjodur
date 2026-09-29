// @vitest-environment node
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import type { AppEnv } from "./env";
import { clientErrorLog, nextTraceparent, parseTraceparent, requestLogging } from "./logging";

describe("traceparent", () => {
  it("parses valid headers and rejects invalid ones", () => {
    expect(parseTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")).toEqual({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      parentId: "00f067aa0ba902b7",
    });
    expect(parseTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01")).toBeNull();
    expect(parseTraceparent("garbage")).toBeNull();
    expect(parseTraceparent(undefined)).toBeNull();
  });

  it("continues a trace with a new span or starts a fresh one", () => {
    const continued = nextTraceparent("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
    expect(continued.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(continued.spanId).not.toBe("00f067aa0ba902b7");
    expect(continued.header).toBe(`00-${continued.traceId}-${continued.spanId}-01`);

    const fresh = nextTraceparent(undefined);
    expect(fresh.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(fresh.spanId).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("requestLogging", () => {
  function app() {
    const a = new Hono<AppEnv>();
    a.use("*", requestLogging());
    a.get("/ok", (c) => c.text(`trace ${c.var.traceId}`));
    a.get("/boom", () => {
      throw new Error("boom");
    });
    a.post("/log/client", clientErrorLog());
    return a;
  }

  it("exposes the trace id to handlers and the client", async () => {
    const res = await app().request("/ok");
    const traceId = res.headers.get("x-trace-id")!;
    expect(traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(await res.text()).toBe(`trace ${traceId}`);
  });

  it("does not swallow errors", async () => {
    const res = await app().request("/boom");
    expect(res.status).toBe(500);
  });

  it("accepts well-formed client error reports and rejects the rest", async () => {
    const a = app();
    const ok = await a.request("/log/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "TypeError: x is undefined", url: "http://localhost/app" }),
    });
    expect(ok.status).toBe(204);
    expect((await a.request("/log/client", { method: "POST", body: "not json" })).status).toBe(400);
    expect((await a.request("/log/client", { method: "POST", headers: { "content-length": "999999" } })).status).toBe(
      413,
    );
  });
});
