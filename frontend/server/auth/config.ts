/**
 * Configuration of the OIDC "backend for frontend".
 *
 * Every value can be set through environment variables; the defaults match the
 * local Keycloak from infra/docker-compose.yml so `pnpm dev` works out of the box.
 * In production the secrets must be set explicitly – see assertProductionReady().
 */
export interface AuthConfig {
  /** OIDC issuer, e.g. http://localhost:8081/realms/sjodur */
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Public origin of this server, used for redirect URIs, e.g. https://sjodur.io */
  publicUrl: string;
  /** Secret for signing short-lived login cookies (state, PKCE verifier). */
  sessionSecret: string;
  /** Set the Secure attribute on cookies; true whenever publicUrl uses https. */
  cookieSecure: boolean;
  /** Idle lifetime of a browser session in seconds. */
  sessionTtlSeconds: number;
  /** Optional Redis connection string; without it sessions live in memory (dev only). */
  redisUrl?: string;
  /** Scopes requested at login. offline_access gives a refresh token in Keycloak. */
  scope: string;
  /** Base URL of the Spring backend for the /api proxy. */
  apiUrl: string;
}

const DEV_CLIENT_SECRET = "sjodur-web-secret-change-me";
const DEV_SESSION_SECRET = "dev-only-session-secret-change-me-please";

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const publicUrl = (env.SJODUR_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    issuer: (env.SJODUR_OIDC_ISSUER ?? "http://localhost:8081/realms/sjodur").replace(/\/$/, ""),
    clientId: env.SJODUR_OIDC_CLIENT_ID ?? "sjodur-web",
    clientSecret: env.SJODUR_OIDC_CLIENT_SECRET ?? DEV_CLIENT_SECRET,
    publicUrl,
    sessionSecret: env.SJODUR_SESSION_SECRET ?? DEV_SESSION_SECRET,
    cookieSecure: env.SJODUR_COOKIE_SECURE ? env.SJODUR_COOKIE_SECURE === "true" : publicUrl.startsWith("https://"),
    sessionTtlSeconds: Number(env.SJODUR_SESSION_TTL ?? 12 * 60 * 60),
    redisUrl: env.REDIS_URL || undefined,
    scope: env.SJODUR_OIDC_SCOPE ?? "openid profile email offline_access",
    apiUrl: (env.SJODUR_API_URL ?? "http://localhost:8080").replace(/\/$/, ""),
  };
}

/** Refuses to start with development secrets in production. */
export function assertProductionReady(config: AuthConfig, nodeEnv = process.env.NODE_ENV): void {
  if (nodeEnv !== "production") return;
  const problems: string[] = [];
  if (config.clientSecret === DEV_CLIENT_SECRET) problems.push("SJODUR_OIDC_CLIENT_SECRET is the development default");
  if (config.sessionSecret === DEV_SESSION_SECRET) problems.push("SJODUR_SESSION_SECRET is the development default");
  if (config.sessionSecret.length < 32) problems.push("SJODUR_SESSION_SECRET must have at least 32 characters");
  if (!config.redisUrl) problems.push("REDIS_URL is not set – in-memory sessions are lost on restart and do not scale");
  if (!config.cookieSecure) problems.push("cookies are not marked Secure – set SJODUR_PUBLIC_URL to an https URL");
  if (problems.length > 0) {
    throw new Error(`Refusing to start in production:\n - ${problems.join("\n - ")}`);
  }
}
