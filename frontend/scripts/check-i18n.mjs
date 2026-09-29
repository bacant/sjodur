#!/usr/bin/env node
/**
 * Keeps the message catalogs consistent: every locale must have exactly the keys of the
 * reference locale (de), and each translation must use the same named placeholders.
 * Run with `pnpm i18n:check`; the backend relies on the same files.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const dir = "locales";
const reference = "de";

function flatten(obj, prefix = "", out = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object") flatten(value, path, out);
    else out[path] = String(value);
  }
  return out;
}

const placeholders = (text) =>
  [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");

const locales = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => [f.replace(/\.json$/, ""), flatten(JSON.parse(readFileSync(join(dir, f), "utf8")))]),
);
if (!locales[reference]) {
  console.error(`reference locale ${reference}.json not found in ${dir}/`);
  process.exit(1);
}

const problems = [];
for (const [locale, messages] of Object.entries(locales)) {
  if (locale === reference) continue;
  for (const key of Object.keys(locales[reference])) {
    if (!(key in messages)) problems.push(`${locale}: missing key "${key}"`);
    else if (placeholders(messages[key]) !== placeholders(locales[reference][key])) {
      problems.push(
        `${locale}: placeholders differ for "${key}" ({${placeholders(locales[reference][key])}} vs {${placeholders(messages[key])}})`,
      );
    }
  }
  for (const key of Object.keys(messages)) {
    if (!(key in locales[reference])) problems.push(`${locale}: extra key "${key}" not in ${reference}`);
  }
}
for (const [locale, messages] of Object.entries(locales)) {
  for (const [key, value] of Object.entries(messages)) {
    if (/\{\d+\}/.test(value)) problems.push(`${locale}: positional placeholder in "${key}" – use named placeholders`);
    if (value.trim() === "") problems.push(`${locale}: empty translation for "${key}"`);
  }
}

console.log(`${Object.keys(locales).join(", ")}: ${Object.keys(locales[reference]).length} keys each`);
if (problems.length > 0) {
  console.error("i18n check failed:");
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log("i18n check passed.");
