/**
 * Reports uncaught browser errors to the frontend server (POST /log/client), which logs
 * them with the trace id. Fire-and-forget; never throws. Nothing personal is sent beyond
 * the error text and the page URL.
 */
export function reportClientError(error: unknown, source: string): void {
  if (typeof window === "undefined" || typeof fetch !== "function") return;
  const err = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({
    message: err.message,
    stack: err.stack,
    url: window.location.href,
    source,
  });
  try {
    fetch("/log/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
