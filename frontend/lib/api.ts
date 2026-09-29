import { usePageContext } from "vike-vue/usePageContext";
import { useI18n } from "vue-i18n";

export const CSRF_HEADER = "X-CSRF-Token";

/**
 * fetch() for the Sjodur API from components: same-origin, JSON by default, the UI language
 * as Accept-Language, and the session's CSRF token on every state-changing request
 * (server/auth rejects them otherwise). Error responses are problem details – see lib/problem.ts.
 * A 401 with error "session_expired" means the session could not be refreshed – reload
 * the page and the guard sends the user to the login.
 */
export function useApi() {
  const pageContext = usePageContext();
  const { locale } = useI18n();

  async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has("accept")) headers.set("accept", "application/json");
    // The backend localises problem details, e-mails and exports with the language chosen in the UI.
    headers.set("accept-language", locale.value);
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
