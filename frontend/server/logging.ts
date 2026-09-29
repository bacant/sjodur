import { randomBytes } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import pino, { type Logger, type LoggerOptions } from "pino";
import type { AppEnv } from "./env";

/**
 * Logging for the frontend server.
 *
 * Production: one JSON object per line with the same field names Spring Boot's ECS
 * structured logging uses (@timestamp, log.level, message, service.name, trace.id),
 * so backend and frontend logs can be searched together.
 * Development: human-readable, coloured lines via pino-pretty.
 *
 * Every request gets a W3C trace context: an incoming `traceparent` is continued, otherwise
 * a new trace is started. The id is logged, returned as `X-Trace-Id`, and the outgoing
 * `traceparent` is forwarded to the backend by the API proxy – Spring's Micrometer Tracing
 * picks it up, so one trace id spans browser, frontend server and backend.
 */

const SERVICE_NAME = "sjodur-frontend";
const isProduction = process.env.NODE_ENV === "production";
const isTest = !!process.env.VITEST;
const jsonLogs = isProduction || isTest || process.env.LOG_FORMAT === "json";

const options: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? (isTest ? "silent" : isProduction ? "info" : "debug"),
  messageKey: "message",
  // Secrets never reach the logs, whatever gets logged by accident.
  redact: {
    paths: ["*.cookie", "*.authorization", "*.set-cookie", "headers.cookie", "headers.authorization"],
    censor: "[redacted]",
  },
  ...(jsonLogs
    ? {
        timestamp: () => `,"@timestamp":"${new Date().toISOString()}"`,
        formatters: {
          level: (label) => ({ "log.level": label.toUpperCase() }),
          bindings: () => ({ "service.name": SERVICE_NAME }),
        },
      }
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service.name",
            messageKey: "message",
          },
        },
      }),
};

export const logger: Logger = pino(options);

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

export function parseTraceparent(value: string | undefined | null): { traceId: string; parentId: string } | null {
  if (!value) return null;
  const match = TRACEPARENT.exec(value.trim().toLowerCase());
  if (!match) return null;
  const [, traceId, parentId] = match;
  if (/^0+$/.test(traceId) || /^0+$/.test(parentId)) return null;
  return { traceId, parentId };
}

/** Continues an incoming trace (new child span) or starts a new one. */
export function nextTraceparent(incoming?: string | null): { traceId: string; spanId: string; header: string } {
  const parsed = parseTraceparent(incoming);
  const traceId = parsed?.traceId ?? randomBytes(16).toString("hex");
  const spanId = randomBytes(8).toString("hex");
  return { traceId, spanId, header: `00-${traceId}-${spanId}-01` };
}

const QUIET_PATHS = /^\/(assets\/|favicon|brand\/|apple-touch-icon)/;

export function requestLogging(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const start = performance.now();
    const trace = nextTraceparent(c.req.header("traceparent"));
    c.set("traceId", trace.traceId);
    c.set("traceparent", trace.header);
    c.set("log", logger.child({ "trace.id": trace.traceId, "span.id": trace.spanId }));

    let failure: unknown;
    try {
      await next();
      // After the handler: works for responses Hono built and for raw Responses (proxy, Vike) alike.
      c.header("X-Trace-Id", trace.traceId);
    } catch (error) {
      failure = error;
      throw error;
    } finally {
      const path = new URL(c.req.url).pathname;
      const status = failure ? 500 : c.res.status;
      const entry = {
        "http.request.method": c.req.method,
        "url.path": path,
        "http.response.status_code": status,
        "event.duration_ms": Math.round(performance.now() - start),
        "user.id": c.var.session?.user.sub,
        "client.address": c.req.header("x-forwarded-for")?.split(",")[0]?.trim(),
        "user_agent.original": c.req.header("user-agent"),
      };
      const log = c.var.log;
      if (failure) log.error({ ...entry, err: failure }, "request failed");
      else if (QUIET_PATHS.test(path)) log.debug(entry, "request");
      else if (status >= 500) log.error(entry, "request");
      else if (status >= 400) log.warn(entry, "request");
      else log.info(entry, "request");
    }
  };
}

export interface ClientErrorReport {
  message: string;
  stack?: string;
  url?: string;
  source?: string;
}

const MAX_REPORT_BYTES = 8 * 1024;

/** Accepts error reports from the browser (lib/report.ts) and logs them with the trace id. */
export function clientErrorLog(): MiddlewareHandler<AppEnv> {
  return async (c) => {
    const length = Number(c.req.header("content-length") ?? 0);
    if (length > MAX_REPORT_BYTES) return c.body(null, 413);
    let report: ClientErrorReport;
    try {
      report = (await c.req.json()) as ClientErrorReport;
    } catch {
      return c.body(null, 400);
    }
    if (typeof report?.message !== "string") return c.body(null, 400);
    c.var.log.warn(
      {
        "error.message": report.message.slice(0, 1000),
        "error.stack_trace": typeof report.stack === "string" ? report.stack.slice(0, 4000) : undefined,
        "url.full": typeof report.url === "string" ? report.url.slice(0, 500) : undefined,
        "event.source": typeof report.source === "string" ? report.source.slice(0, 100) : undefined,
        "user.id": c.var.session?.user.sub,
        "user_agent.original": c.req.header("user-agent"),
      },
      "client error",
    );
    return c.body(null, 204);
  };
}
