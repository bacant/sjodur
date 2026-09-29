import vike from "@vikejs/hono";
import { Hono } from "hono";
import {
  apiProxy,
  assertProductionReady,
  authRoutes,
  createSessionStore,
  loadAuthConfig,
  OidcClient,
  requireSameOrigin,
  sessionMiddleware,
  userContext,
  type AuthEnv,
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

/**
 * Request pipeline:
 *   1. load the session referenced by the cookie
 *   2. /auth/*   login, callback, logout, me (OIDC "backend for frontend")
 *   3. /api/*    CSRF check for cookie-authenticated writes, then proxy to Spring with Bearer token
 *   4. Vike      pages and assets, with pageContext.user
 */
function getApp() {
  const app = new Hono<AuthEnv>();

  app.use("*", sessionMiddleware(store, config));
  app.route("/auth", authRoutes(store, oidc, config));
  app.use("/api/*", requireSameOrigin(config));
  app.all("/api/*", apiProxy(store, oidc, config));

  vike(app, [userContext]);

  return app;
}

export const app = getApp();
