#!/usr/bin/env node
/**
 * Licence guard for production dependencies.
 *
 *   node scripts/check-licenses.mjs            fails (exit 1) on licences outside the allow-list
 *   node scripts/check-licenses.mjs --notices  additionally writes THIRD-PARTY-NOTICES.md
 *
 * Two rules:
 *  1. Every production dependency must use a licence from ALLOWED (all compatible with
 *     Sjodur's Apache-2.0 licence when used as an unmodified dependency).
 *  2. The Vike packages must stay MIT. Vike has announced an "Open Source Pricing" model
 *     under which the npm package may adopt a proprietary licence; if that happens this
 *     check fails and ADR-0002 (docs/adr) describes the exit: plain Vite + Vue.
 */
import { execSync } from "node:child_process";
import process from "node:process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "ISC",
  "0BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "Apache-2.0",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
  "OFL-1.1",
  "MPL-2.0",
  "BlueOak-1.0.0",
  "Python-2.0",
  "Zlib",
  "PSF-2.0",
  "(MIT OR CC0-1.0)",
  "(MIT OR Apache-2.0)",
  "(MIT AND Zlib)",
  "(BSD-2-Clause OR MIT OR Apache-2.0)",
]);

/** Packages whose licence must not change silently. */
const PINNED = { vike: "MIT", "vike-vue": "MIT", "vike-vue-pinia": "MIT", "@vikejs/hono": "MIT" };

const writeNotices = process.argv.includes("--notices");

const raw = execSync("pnpm licenses list --json --prod", { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
/** @type {Record<string, Array<{name: string, versions: string[], paths: string[], license: string, homepage?: string, author?: string}>>} */
const byLicense = JSON.parse(raw);

const packages = Object.values(byLicense)
  .flat()
  .sort((a, b) => a.name.localeCompare(b.name));
const problems = [];

for (const pkg of packages) {
  const pinned = PINNED[pkg.name];
  if (pinned && pkg.license !== pinned) {
    problems.push(
      `${pkg.name}@${pkg.versions.join(",")}: licence is "${pkg.license}", expected "${pinned}" – see docs/adr/0002-vike-frontend-framework.md`,
    );
  } else if (!ALLOWED.has(pkg.license)) {
    problems.push(`${pkg.name}@${pkg.versions.join(",")}: licence "${pkg.license}" is not on the allow-list`);
  }
}

// Belt and braces for the pinned packages: pnpm reports what the store knows, so also read the
// installed package.json and the licence file itself.
for (const [name, expected] of Object.entries(PINNED)) {
  const dir = join("node_modules", name);
  if (!existsSync(dir)) continue;
  const manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  if (manifest.license !== expected) {
    problems.push(`${name}: installed package.json declares "${manifest.license}", expected "${expected}"`);
  }
  const text = licenseText(dir);
  if (!text || !new RegExp(`^\\s*${expected} Licen[cs]e`, "i").test(text)) {
    problems.push(`${name}: licence file is missing or no longer the ${expected} licence text`);
  }
}

const summary = Object.entries(byLicense)
  .map(([license, pkgs]) => `${license}: ${pkgs.length}`)
  .sort()
  .join(", ");
console.log(`${packages.length} production packages – ${summary}`);

if (writeNotices) {
  const lines = [
    "# Third-party notices",
    "",
    "Sjodur's web frontend bundles the following open source packages. Each is listed with its licence; the licence texts are reproduced below where the package ships one.",
    "",
    `Generated on ${new Date().toISOString().slice(0, 10)} with \`pnpm licenses:notices\`.`,
    "",
  ];
  for (const pkg of packages) {
    lines.push(`## ${pkg.name} ${pkg.versions.join(", ")}`, "");
    lines.push(`- Licence: ${pkg.license}`);
    if (pkg.author) lines.push(`- Author: ${pkg.author}`);
    if (pkg.homepage) lines.push(`- Homepage: ${pkg.homepage}`);
    const text = licenseText(pkg.paths[0]);
    if (text) lines.push("", "```", text.trim(), "```");
    lines.push("");
  }
  writeFileSync("THIRD-PARTY-NOTICES.md", lines.join("\n"));
  console.log("wrote THIRD-PARTY-NOTICES.md");
}

if (problems.length > 0) {
  console.error("\nLicence check failed:");
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log("Licence check passed.");

function licenseText(dir) {
  if (!dir || !existsSync(dir)) return null;
  const file = readdirSync(dir).find((f) => /^(LICEN[CS]E|COPYING)(\.(md|txt|markdown))?$/i.test(f));
  if (!file) return null;
  const content = readFileSync(join(dir, file), "utf8");
  return content.length > 20_000 ? content.slice(0, 20_000) + "\n[truncated]" : content;
}
