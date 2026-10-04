import { describe, expect, it } from "vitest";
import { readProblem } from "./problem";

describe("readProblem", () => {
  it("reads problem details and the trace id header", async () => {
    const response = new Response(
      JSON.stringify({
        status: 404,
        code: "not_found",
        detail: "Der Eintrag wurde nicht gefunden.",
        params: { id: "42" },
      }),
      { status: 404, headers: { "content-type": "application/problem+json", "x-trace-id": "abc" } },
    );
    expect(await readProblem(response)).toEqual({
      status: 404,
      code: "not_found",
      detail: "Der Eintrag wurde nicht gefunden.",
      params: { id: "42" },
      traceId: "abc",
    });
  });

  it("copes with non-JSON error bodies", async () => {
    const response = new Response("Bad Gateway", { status: 502 });
    expect(await readProblem(response)).toEqual({ status: 502, traceId: undefined });
  });
});
