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

Configured in `backend/src/main/resources/logback-spring.xml`. Every line carries the request
context from the MDC: `[client.ip|user.id]`, the trace id, the thread, `[entity|entity.id]`
and the logger.

```
2026-09-29 10:48:29.630 [10.0.0.7|8f1c9a…] INFO  [4bf92f3577b34da6a3ce929d0e0e4736] [http-nio-8080-exec-3] [Transaction|42] TransactionService : booked
```

| Profile | Appenders | Levels |
|---|---|---|
| `local` (default) | coloured console, rolling file `logs/sjodur.log`, per-job files (SIFT) | `io.sjodur` DEBUG, SQL statements, OIDC token validation DEBUG |
| `prod` | ECS JSON on stdout (Boot's `StructuredLogEncoder`) | `io.sjodur` INFO, Spring WARN |
| `prod,file` | plus the rolling files | |
| `prod,mail` | plus error digests by e-mail | |

Profiles combine: `SPRING_PROFILES_ACTIVE=prod,file,mail`.

**Files.** The directory comes from `logging.file.path` (env `LOGGING_FILE_PATH`), exposed to
Logback as `LOG_PATH`, default `logs`. It does not have to be absolute – a relative path is
resolved against the JVM's working directory, which is `backend/` under `./gradlew bootRun`
but may be the repository root in an IDE and `/app` in a container. That is why `local`
defaults to a relative `logs/` (git-ignored, next to the code) and `prod` to
`/var/log/sjodur`, and why containers do not write files at all unless the `file` profile is
on and a volume is mounted there: on a container's ephemeral filesystem, stdout is the log
file. Rotation: 200 MB per file, daily, 60 days, 5 GB cap, gzipped (`SizeAndTimeBasedRollingPolicy`).

**Per-job files (SIFT).** `try (var ignored = LogContext.file("import-42")) { … }` routes every
line inside the block into `logs/sjodur.import-42.log` in addition to the main log. Lines
without the MDC key never reach the sifting appender (`MdcPresentFilter`), so there is no
duplicate "default" file.

**Entity context.** `try (var ignored = LogContext.entity("Transaction", id)) { … }` fills the
`[entity|entity.id]` slot for the block; nested scopes restore the previous values.

**E-mail digests.** `DigestSmtpAppender` extends Logback's `SMTPAppender` and sends one mail
per interval instead of one per error: the first ERROR starts a five-minute timer, everything
arriving until then goes into the same mail (max 50 events, the rest is counted), so an
outage produces a handful of mails, not hundreds. Host, port, recipients come from
`sjodur.logging.mail.*` (env `SJODUR_MAIL_HOST`, `SJODUR_ALERT_MAIL`, …); authentication and
TLS are configured exactly like Logback's `SMTPAppender` (`username`, `password`, `starttls`).
Requires `spring-boot-starter-mail` on the classpath.

**Trace ids.** Micrometer Tracing (`spring-boot-micrometer-tracing-opentelemetry` +
`micrometer-tracing-bridge-otel`, see `build.gradle.additions.txt`) continues the frontend's
`traceparent` and puts `traceId`/`spanId` into the MDC before any other filter runs.
`RequestLoggingFilter` echoes it as `X-Trace-Id`, logs one line per `/api` request under the
logger `http.request` and sets `client.ip` and `user.id` for the request. Exporting spans to a
collector is a later step (`spring-boot-starter-opentelemetry`).

Use `LoggerFactory.getLogger(MyService.class)` (SLF4J) in application code. Log the *what*,
not personal data: ids, counts, states – never amounts, names or e-mail addresses.

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
