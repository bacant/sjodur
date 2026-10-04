import type { Logger } from "pino";
import type { Session } from "./auth/session";

/** Hono environment shared by every server module: request-scoped variables set by middleware. */
export type AppEnv = {
  Variables: {
    /** Set by sessionMiddleware (server/auth). */
    session: Session | null;
    /** Set by requestLogging (server/logging): W3C trace id and the outgoing traceparent header. */
    traceId: string;
    traceparent: string;
    /** Request-scoped logger with trace id and user bound. */
    log: Logger;
  };
};
