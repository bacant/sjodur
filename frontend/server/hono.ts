import vike from "@vikejs/hono";
import { Hono } from "hono";
import type { AppEnv } from "./env";
import { clientErrorLog, logger, requestLogging } from "./logging";
import {
  apiProxy,
  assertProductionReady,
  authRoutes,
  createSessionStore,
  csrfProtection,
  loadAuthConfig,
  OidcClient,
  sessionMiddleware,
  userContext,
} from "./auth";

// Local development reads frontend/.env (see .env.example); containers get real environment variables.
try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file – fine */
}

const config = loadAuthConfig();
assertProductionReady(config);
const store = await createSessionStore(config);
const oidc = new OidcClient(config);

logger.info(
  { "service.name": "sjodur-frontend", issuer: config.issuer, api: config.apiUrl },
  "frontend server starting",
);

/**
 * Request pipeline:
 *   1. trace id + request log (server/logging), then the session referenced by the cookie
 *   2. /log/client  error reports from the browser
 *   3. /auth/*      login, callback, logout (POST + CSRF token), me (OIDC "backend for frontend")
 *   4. /api/*       CSRF protection for cookie-authenticated writes, then proxy to Spring with Bearer token
 *   5. Vike         pages and assets, with pageContext.user
 */
function getApp() {
  const app = new Hono<AppEnv>();

  // Liveness for load balancers and orchestrators; no session, no logging noise.
  app.get("/healthz", (c) => c.json({ status: "ok" }));

  app.use("*", requestLogging());
  app.use("*", sessionMiddleware(store, config));
  app.post("/log/client", clientErrorLog());
  app.use("/auth/logout", csrfProtection(config, { allowFormField: true }));
  app.route("/auth", authRoutes(store, oidc, config));
  app.use("/api/*", csrfProtection(config));
  app.all("/api/*", apiProxy(store, oidc, config));

  vike(app, [userContext]);

  return app;
}

export const app = getApp();
