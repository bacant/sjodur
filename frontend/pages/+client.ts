// Runs once in the browser before hydration. https://vike.dev/client
import { reportClientError } from "../lib/report";

window.addEventListener("error", (event) => reportClientError(event.error ?? event.message, "window.error"));
window.addEventListener("unhandledrejection", (event) => reportClientError(event.reason, "unhandledrejection"));
