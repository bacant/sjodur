// Runs once per Vue app instance: on the server for every request, on the client once. https://vike.dev/onCreateApp
import type { PageContext } from "vike/types";
import { createAppI18n } from "../lib/i18n";
import { reportClientError } from "../lib/report";

export function onCreateApp(pageContext: PageContext) {
  const { app } = pageContext;
  if (!app) return;
  app.use(createAppI18n());

  // Errors thrown inside components: log them in the browser console and report them to the server.
  app.config.errorHandler = (error, _instance, info) => {
    console.error(error);
    reportClientError(error, `vue:${info}`);
  };
}
