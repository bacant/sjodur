import vike from "@vikejs/hono";
import { Hono } from "hono";
import { proxy } from "hono/proxy";

/**
 * Base URL of the Spring Boot backend. All requests to /api/* are forwarded there,
 * in development (vike dev) and in production alike, so the browser only ever talks
 * to one origin and no CORS configuration is needed.
 */
const API_URL = (process.env.SJODUR_API_URL ?? "http://localhost:8080").replace(/\/$/, "");

function getApp() {
  const app = new Hono();

  app.all("/api/*", (c) => {
    const url = new URL(c.req.url);
    return proxy(`${API_URL}${url.pathname}${url.search}`, {
      ...c.req,
      headers: {
        ...c.req.header(),
        "x-forwarded-host": c.req.header("host") ?? "",
        "x-forwarded-proto": url.protocol.replace(":", ""),
      },
    });
  });

  // Vike handles everything else (pages, assets).
  vike(app);

  return app;
}

export const app = getApp();
