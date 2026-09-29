# Logging and tracing

Both halves of Sjodur log the same way: human-readable lines in development, one ECS-shaped
JSON object per line in production, and a W3C trace id that follows a request from the
browser through the frontend server into the backend.

```
Browser ──▶ Hono (pino)                    ──traceparent──▶ Spring (Logback, Micrometer Tracing)
             log: trace.id, user.id, path                    log: traceId, user.id, path
             response: X-Trace-Id                             response: X-Trace-Id
```

## Backend (Spring Boot + Logback)

Spring Boot uses Logback out of the box; there is no `logback-spring.xml` because everything
needed is a property:

| Profile | Output | Where configured |
|---|---|---|
| `local` (default) | classic pattern with `[sjodur,traceId,spanId]`, SQL statements at DEBUG | `application.yml` → `logging.level.*` |
| `prod` | ECS JSON (`@timestamp`, `log.level`, `message`, `service.name`, `trace.id`, …) via Boot's built-in structured logging | `application-prod.yml` → `logging.structured.format.console: ecs` |

Dependencies (see `backend/build.gradle.additions.txt`): `spring-boot-micrometer-tracing-opentelemetry`
and `micrometer-tracing-bridge-otel`. With them, Micrometer Tracing creates a span per request,
continues an incoming `traceparent`, and puts `traceId`/`spanId` into the MDC – every log line
carries them without further code. Exporting spans to a collector (Tempo, Jaeger, an OTel
collector) is a later step: swap in `spring-boot-starter-opentelemetry` and set
`management.opentelemetry.tracing.export.otlp.endpoint`.

`RequestLoggingFilter` (`io.sjodur.logging`) writes one line per `/api` request – method, path,
status, duration – under the logger `http.request`, puts the user's `sub` into the MDC as
`user.id`, and returns `X-Trace-Id`. It runs after the security filter chain, so the user is
known; requests that Spring Security rejects before that (401) show up in the
`http.server.requests` metric rather than in this log.

Use `private static final Logger log = LoggerFactory.getLogger(MyService.class)` (SLF4J) in
application code. Log the *what*, not personal data: ids, counts, states – never amounts,
names or e-mail addresses.

A `logback-spring.xml` becomes necessary only for things properties cannot express: log files
with rotation (containers should log to stdout instead), custom masking, or additional
appenders.

## Frontend server (Hono + pino)

`frontend/server/logging.ts`:

- `logger` – pino, JSON with ECS field names when `NODE_ENV=production` (or `LOG_FORMAT=json`),
  pino-pretty otherwise; level from `LOG_LEVEL` (default `info` in production, `debug` in
  development). Cookies and Authorization headers are redacted wherever they appear.
- `requestLogging()` – parses or creates the `traceparent`, exposes `c.var.traceId`,
  `c.var.traceparent` and a request-scoped `c.var.log`, returns `X-Trace-Id`, and logs one
  line per request with method, path, status, duration and `user.id`. Static assets are logged
  at `debug` so they do not drown everything else.
- The API proxy forwards `traceparent`, so the backend's `traceId` equals the frontend's
  `trace.id`; the browser sees the same id in `X-Trace-Id` and problem details carry it too.
- `POST /log/client` – receives uncaught browser errors (`lib/report.ts`, wired in
  `pages/+client.ts` and the Vue `errorHandler`) and logs them at `warn` with the trace id.
  The body is capped at 8 KB and contains the message, stack, page URL and source only.

Handlers log through `c.var.log` (or `logOf(c)` inside the auth module).

## Browser

Errors reach the server through `reportClientError()`. Beyond that the browser is silent by
design – no third-party telemetry. When an error-tracking service is wanted later (Sentry was
an option in the scaffolder), it can be added without touching the server side.

## Searching across both

Every JSON line from either service has `service.name` (`sjodur-frontend` / `sjodur-backend`)
and `trace.id`. Filtering a log store by `trace.id` shows the full path of one request. The
`X-Trace-Id` a user reads off an error page is that same id, which is why the UI shows it as
"Support-Kennung".
