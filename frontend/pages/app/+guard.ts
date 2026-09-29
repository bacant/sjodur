// Runs before rendering any page below /app, on the server and on client-side navigation. https://vike.dev/guard
import { redirect } from "vike/abort";
import type { PageContext } from "vike/types";

export function guard(pageContext: PageContext) {
  if (!pageContext.user) {
    const returnTo = encodeURIComponent(pageContext.urlPathname);
    // Absolute URL → full page load, because /auth/login is a server route and not a Vike page.
    throw redirect(`${pageContext.urlParsed.origin}/auth/login?returnTo=${returnTo}`);
  }
}
