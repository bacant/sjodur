/**
 * UI strings. The JSON files are the single source of truth for the whole system:
 * the web frontend imports them here, the Spring backend copies them into its jar at
 * build time (backend/build.gradle → processResources) and reads them through its
 * Messages service. Keep them in sync with `pnpm i18n:check`.
 *
 * Conventions shared with the backend (see docs/i18n.md):
 *  - keys are dotted paths (problem.not_found), values plain strings
 *  - placeholders are named: {name}, {min} – never positional {0}
 *  - plural forms are separate keys (items.one / items.other), no ICU syntax
 */
import de from "./de.json";
import en from "./en.json";

export type MessageSchema = typeof de;

const messages: { de: MessageSchema; en: MessageSchema } = { de, en };

export default messages;
