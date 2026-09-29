import { usePageContext } from "vike-vue/usePageContext";

export const CSRF_HEADER = "X-CSRF-Token";

/**
 * fetch() for the Sjodur API from components: same-origin, JSON by default, and the
 * session's CSRF token on every state-changing request (server/auth rejects them otherwise).
 * A 401 with error "session_expired" means the session could not be refreshed – reload
 * the page and the guard sends the user to the login.
 */
export function useApi() {
  const pageContext = usePageContext();

  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("accept")) headers.set("accept", "application/json");
    const method = (init.method ?? "GET").toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method) && pageContext.csrfToken) {
      headers.set(CSRF_HEADER, pageContext.csrfToken);
    }
    if (init.body && typeof init.body === "string" && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
    if (response.status === 401 && typeof window !== "undefined") {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (body?.error === "session_expired") window.location.reload();
    }
    return response;
  }

  return { apiFetch, csrfToken: pageContext.csrfToken };
}
