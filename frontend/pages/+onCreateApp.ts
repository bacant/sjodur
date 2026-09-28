// Runs once per Vue app instance: on the server for every request, on the client once. https://vike.dev/onCreateApp
import type { PageContext } from "vike/types";
import { createAppI18n } from "../lib/i18n";

export function onCreateApp(pageContext: PageContext) {
  const { app } = pageContext;
  if (!app) return;
  app.use(createAppI18n());
}
